import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import imaps from "imap-simple";
import { simpleParser } from "mailparser";
import {
  db,
  dbReady,
  createUser,
  findUserByEmail,
  findUserById,
  listUsers,
  deleteUser,
  updateUserPassword,
  updateUserGmailConfig,
  clearUserGmailConfig,
  hashPassword,
  type UserDoc,
  getTasks as pgGetTasks,
  createTask as pgCreateTask,
  toggleTask as pgToggleTask,
  deleteTask as pgDeleteTask,
  getCalendarEvents as pgGetCalendarEvents,
  createCalendarEvent as pgCreateCalendarEvent,
  deleteCalendarEvent as pgDeleteCalendarEvent,
  getExpenses as pgGetExpenses,
  createExpense as pgCreateExpense,
  deleteExpense as pgDeleteExpense,
  setTelegramConfig,
  getTelegramConfig,
  findUserByTelegramChatId,
} from "../../db.js";
import multer from "multer";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
// pdf-parse (via pdfjs-dist) needs browser APIs (DOMMatrix) that don't
// exist in Node's serverless runtime. Importing it at the top level was
// crashing the ENTIRE server on every single request — including ones with
// nothing to do with PDFs (calendar, tasks, admin) — because a crash during
// module import takes down the whole function. It's now loaded lazily,
// inside extractTextFromFile, only when a PDF is actually uploaded, and
// wrapped so a PDF-specific failure no longer takes anything else down.

// Vercel serverless functions hard-cap the request body at 4.5MB — this is
// a platform limit, not a number we chose, and it cannot be raised from
// application code. Capping here means the app fails with a clear message
// BEFORE hitting that wall, instead of Vercel silently returning a non-JSON
// 413 that shows up to the user as a generic "Failed to upload file."
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB, leaving headroom under 4.5MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const name = file.originalname.toLowerCase();
  const textExts = [".txt", ".md", ".js", ".jsx", ".ts", ".tsx", ".py", ".json", ".csv", ".html", ".css"];
  try {
    if (name.endsWith(".pdf") || file.mimetype === "application/pdf") {
      try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: file.buffer });
        const result = await parser.getText();
        await parser.destroy();
        return result.text || "";
      } catch (pdfErr) {
        console.warn("PDF text extraction unavailable in this environment:", pdfErr);
        return "";
      }
    }
    if (textExts.some(ext => name.endsWith(ext))) {
      return file.buffer.toString("utf-8");
    }
    return ""; // Unsupported binary type (e.g. .docx, images) — no extraction yet.
  } catch (err) {
    console.warn("Text extraction failed for", file.originalname, err);
    return "";
  }
}

dotenv.config();

const app = express();

// Gate every request behind the database finishing its (async) WASM load.
// sql.js has to load a .wasm module before it's usable, unlike the old
// native better-sqlite3 which was ready synchronously at import time. This
// middleware is registered FIRST so every route below can keep calling
// db.prepare(...).get/.all/.run(...) synchronously, exactly as before —
// by the time a route handler runs, the real database is guaranteed ready.
app.use((req, res, next) => {
  dbReady.then(() => next()).catch(next);
});

// Default body limit is 100kb — too small for base64-encoded files coming
// back from the Laptop Companion's "get_file" command, so raise it. 30mb
// covers most docs/images/small archives; the companion script itself also
// enforces a size cap before it even reads the file (see code-templates.ts).
app.use(express.json({ limit: "30mb" }));

// Initialize Gemini SDK with a User-Agent header for telemetry
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "mkagent-server",
        },
      },
    })
  : null;

// ============================================================================
// USER ACCOUNTS, SESSIONS & AUTH
// In-memory only — wiped on cold start/redeploy, same limitation as the rest
// of this app's state. Each user has their own Gmail connection and their
// own dashboard state; nothing here is shared between users except the
// admin's ability to list/remove accounts.
// ============================================================================

// hashPassword, createUser, findUserByEmail, findUserById now come from
// db.ts (Firestore-backed, so accounts survive cold starts/redeploys on
// Vercel instead of living only in ephemeral /tmp SQLite).

function toPublicUser(user: UserDoc) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: !!user.is_admin,
    createdAt: user.created_at,
    gmailConnected: !!user.gmail_email,
    gmailEmail: user.gmail_email || null
  };
}

// Seed the one admin account. Set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME
// as Vercel environment variables to control these; falls back to defaults
// below if unset. CHANGE THE DEFAULT PASSWORD before sharing your deployed
// URL with anyone.
const seedAdminEmail = process.env.ADMIN_EMAIL || "admin@mkagent.local";
const seedAdminPassword = process.env.ADMIN_PASSWORD || "murali@93927";
const seedAdminName = process.env.ADMIN_NAME || "Admin";
dbReady.then(async () => {
  const existing = await findUserByEmail(seedAdminEmail);
  if (!existing) {
    try {
      await createUser(seedAdminName, seedAdminEmail, seedAdminPassword, true);
    } catch (err: any) {
      // Another concurrent cold start already created it a moment ago —
      // that's fine, nothing left to do here.
      if (!String(err?.message || err).includes("duplicate key")) throw err;
    }
  } else {
    // Keep the admin account's password in sync with the currently
    // configured ADMIN_PASSWORD/default. Without this, an admin row
    // persisted from a previous deploy (with an older default password)
    // would silently keep rejecting the new one after a code change.
    await updateUserPassword(existing.id, seedAdminPassword);
  }
}).catch(err => console.error("Failed to seed admin account:", err));

// Device-scoped users: the frontend has no login screen, so each browser
// generates its own random device id (stored in localStorage) and sends it
// as "X-Device-Id". The first time we see a device id we transparently
// create a private, non-admin account for it and remember the mapping. This
// is what lets each visitor connect *their own* Gmail address + App Password
// straight from the dashboard, fully isolated from every other visitor,
// with no shared/admin password involved anywhere in that flow.
async function getOrCreateDeviceUser(deviceId: string): Promise<UserDoc> {
  const deviceEmail = `${deviceId}@device.local`;

  // The device_sessions mapping below lives in LOCAL SQLite, which on
  // Vercel is wiped every time a new serverless instance spins up (a very
  // common event — happens on basically every cold start). That means it
  // can't be trusted as the source of truth for "does this device already
  // have an account": a cold start right after this device's account was
  // created would forget the mapping, try to create a *second* account
  // with the same deterministic email below, and Postgres would (correctly)
  // reject it with a duplicate-key error — which is exactly the bug this
  // fixes. Look the account up by its deterministic email in the
  // persistent store first; that's always accurate regardless of which
  // instance handles the request. The local table below is kept only as a
  // best-effort cache to skip that lookup on a warm instance.
  const cachedMapping = db.prepare("SELECT user_id FROM device_sessions WHERE device_id = ?").get(deviceId) as { user_id: string } | undefined;
  const cachedUser = cachedMapping ? await findUserById(cachedMapping.user_id) : undefined;
  if (cachedUser) return cachedUser;

  let user = await findUserByEmail(deviceEmail);

  if (!user) {
    try {
      user = await createUser(
        `Guest ${deviceId.slice(0, 6)}`,
        deviceEmail,
        crypto.randomUUID(),
        false,
        true
      );
    } catch (err: any) {
      // Two concurrent requests from a brand-new device can both reach here
      // at once and race to create the same account. Whichever loses that
      // race hits a duplicate-key error — re-fetch the row the winner just
      // created instead of failing the request.
      if (!String(err?.message || err).includes("duplicate key")) throw err;
      user = await findUserByEmail(deviceEmail);
      if (!user) throw err;
    }
  }

  db.prepare("INSERT OR REPLACE INTO device_sessions (device_id, user_id) VALUES (?, ?)").run(deviceId, user.id);
  return user;
}

// Auth middleware: reads "Authorization: Bearer <token>", attaches req.user.
// Routes that need a logged-in user call this first. Falls back to the
// "X-Device-Id" header (see getOrCreateDeviceUser above) so routes work
// without a real signup/login flow — no admin password required.
async function requireAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const sessionRow = token ? db.prepare("SELECT user_id FROM sessions WHERE token = ?").get(token) as { user_id: string } | undefined : undefined;
    let user = sessionRow ? await findUserById(sessionRow.user_id) : undefined;

    if (!user) {
      const deviceId = (req.headers["x-device-id"] || "").toString().trim();
      if (deviceId && /^[a-zA-Z0-9-]{8,100}$/.test(deviceId)) {
        user = await getOrCreateDeviceUser(deviceId);
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: "Not logged in." });
    }
    req.user = user;
    next();
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Auth check failed: ${err?.message || err}` });
  }
}

// Admin-only middleware: use after requireAuth.
function requireAdmin(req: any, res: any, next: any) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ success: false, error: "Admin access required." });
  }
  next();
}

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters." });
    }
    if (await findUserByEmail(email)) {
      return res.status(409).json({ success: false, error: "An account with that email already exists." });
    }

    const user = await createUser(name, email, password, false);
    const token = crypto.randomUUID();
    db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, user.id, Date.now());
    res.json({ success: true, token, user: toPublicUser(user) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Signup failed: ${err?.message || err}` });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = email ? await findUserByEmail(email) : undefined;
    if (!user || hashPassword(password || "", user.password_salt) !== user.password_hash) {
      return res.status(401).json({ success: false, error: "Invalid email or password." });
    }

    const token = crypto.randomUUID();
    db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, user.id, Date.now());
    res.json({ success: true, token, user: toPublicUser(user) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Login failed: ${err?.message || err}` });
  }
});

// Real, server-side admin unlock: checks the password against the actual
// seeded admin account's hash. Replaces the old client-side
// `if (input === "murali@93927")` check, which anyone could read straight
// out of the browser's JS bundle — the password now never ships to the
// browser at all, and is verified only here.
app.post("/api/admin/verify", async (req, res) => {
  try {
    const { password } = req.body;
    const admin = await findUserByEmail(seedAdminEmail);
    if (!admin || hashPassword(password || "", admin.password_salt) !== admin.password_hash) {
      return res.status(401).json({ success: false, error: "Invalid admin password." });
    }
    const token = crypto.randomUUID();
    db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, admin.id, Date.now());
    res.json({ success: true, token });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Admin verify failed: ${err?.message || err}` });
  }
});

app.post("/api/auth/logout", requireAuth, (req: any, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.json({ success: true });
});

app.get("/api/auth/me", requireAuth, (req: any, res) => {
  res.json({ success: true, user: toPublicUser(req.user) });
});

// Admin: list all users, with real usage counts from each user's own data
// (tasks, calendar events, uploaded documents) — not placeholder numbers.
app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await listUsers();
    const withCounts = rows.map(u => {
      const taskCount = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE user_id = ?").get(u.id) as { c: number }).c;
      const eventCount = (db.prepare("SELECT COUNT(*) as c FROM calendar_events WHERE user_id = ?").get(u.id) as { c: number }).c;
      const docCount = (db.prepare("SELECT COUNT(*) as c FROM document_knowledge WHERE user_id = ?").get(u.id) as { c: number }).c;
      return {
        ...toPublicUser(u),
        isDeviceGuest: !!u.is_device_guest,
        taskCount,
        eventCount,
        docCount
        // Note: login passwords are one-way hashed (scrypt) and cannot be
        // retrieved or displayed here even by the admin — that's by design,
        // not an oversight. Gmail App Passwords are likewise never exposed
        // through this endpoint, even though they're stored to enable IMAP
        // sync; only whether Gmail is connected, and to what address, is
        // shown. Per-user location is intentionally NOT surfaced here either
        // — it stays scoped to each user's own weather widget, never rolled
        // up into a cross-account admin view.
      };
    });
    res.json({ success: true, users: withCounts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list users: ${err?.message || err}` });
  }
});

// Admin: remove a user (cannot remove yourself) — cascades their tasks,
// calendar events, and documents so no orphaned rows are left behind.
app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ success: false, error: "You cannot remove your own admin account." });
    }
    if (!(await findUserById(id))) {
      return res.status(404).json({ success: false, error: "User not found." });
    }
    await deleteUser(id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM device_sessions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM tasks WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM calendar_events WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM document_knowledge WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM study_metrics WHERE user_id = ?").run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to delete user: ${err?.message || err}` });
  }
});

// Mock database of unread emails for standard simulation
const MOCK_EMAILS = [
  {
    id: "msg-1",
    sender: "Sarah Jenkins <sarah.j@company.com>",
    subject: "RE: [URGENT] Q3 Financial Forecast Approval Needed",
    date: "Today, 8:45 AM",
    body: "Hi Team, please find attached the Q3 forecast. I need your final approval by 12:00 PM EST today to submit to the board. There is an immediate risk to our cloud infrastructure budget if we don't adjust our server sizing.",
    category: "Work / Budget",
    priority: "HIGH"
  },
  {
    id: "msg-2",
    sender: "Google Flight Alerts <flights-noreply@google.com>",
    subject: "Flight Confirmation: SFO to JFK - Departure Tomorrow",
    date: "Today, 7:15 AM",
    body: "Your flight UA 2482 is confirmed for departure tomorrow. Boarding starts at 7:30 AM at Terminal 3, Gate F12. Please complete your online check-in today to secure your seat.",
    category: "Travel",
    priority: "MEDIUM"
  },
  {
    id: "msg-3",
    sender: "Newsletter <digest@techbytes.dev>",
    subject: "Weekly AI Digest: GPT-4o fine-tuning & Gemini 1.5 updates",
    date: "Yesterday, 6:00 PM",
    body: "Welcome to TechBytes! Today we look at fine-tuning APIs, the performance improvements of Gemini Flash 3, and why smaller models are taking over edge computing.",
    category: "Newsletter",
    priority: "LOW"
  },
  {
    id: "msg-4",
    sender: "Fintech Alerts <security@banksecure.com>",
    subject: "SECURITY ALERT: Unfamiliar login detected on account ending in *8892",
    date: "Today, 9:10 AM",
    body: "We detected a login from an unrecognized device in Dallas, TX. If this was not you, please immediately log in and lock your debit cards to prevent unauthorized transactions.",
    category: "Finance",
    priority: "HIGH"
  }
];

// Mock database of latest news articles for standard simulation
const MOCK_NEWS = [
  {
    title: "NVIDIA CEO Announces New Blackwell Architecture Production Surge",
    source: "Tech News Daily",
    url: "https://technewsdaily.com/nvidia-blackwell-surge",
    summary: "Production of NVIDIA Blackwell AI chips has entered full-speed mass production, with demand described as 'insane' by leadership.",
    category: "AI / Hardware"
  },
  {
    title: "Federal Reserve Signals Rate Cuts in Coming Quarter",
    source: "Financial Times",
    url: "https://financialtimes.com/fed-signals-cuts",
    summary: "Federal reserve chairs indicate confidence in cooling inflation, suggesting systematic interest rate reductions starting next month.",
    category: "Finance"
  },
  {
    title: "Open-Source AI Models Match Proprietary Benchmarks",
    source: "ML Journal",
    url: "https://mljournal.org/open-source-power",
    summary: "New fine-tuning techniques allow 7B and 8B parameter weights to exceed previous commercial capabilities in standard reasoning tasks.",
    category: "AI"
  },
  {
    title: "SpaceX Successfully Lands Starship Super Heavy Booster",
    source: "Aerospace Weekly",
    url: "https://aerospaceweekly.com/starship-flight-success",
    summary: "The fifth flight test of SpaceX Starship successfully caught the heavy booster back at the launch tower, a historical aerospace engineering feat.",
    category: "Tech / Engineering"
  }
];

// New extensive high-fidelity mock databases for advanced integrations
const MOCK_CALENDAR = [
  { title: "Design Patterns Lecture", date: "Today, 10:00 AM - 11:30 AM", type: "Class" },
  { title: "Algorithms End Sem Exam", date: "July 16, 2026, 09:00 AM", type: "Exam" },
  { title: "System Design Peer Mock Interview", date: "Tomorrow, 4:00 PM", type: "Meeting" },
  { title: "Google Cloud Resume Submission Deadline", date: "July 18, 2026, 11:59 PM", type: "Deadline" }
];

const MOCK_DRIVE_FILES = [
  { name: "My_Updated_Resume_2026.pdf", type: "PDF", size: "245 KB", lastModified: "Yesterday" },
  { name: "ML_Specialization_Certificate.pdf", type: "PDF", size: "1.2 MB", lastModified: "2 weeks ago" },
  { name: "System_Design_Fundamentals_Notes.gdoc", type: "Google Doc", size: "12 KB", lastModified: "Today" },
  { name: "Leetcode_Blind75_CheatSheet.pdf", type: "PDF", size: "410 KB", lastModified: "3 days ago" }
];

const MOCK_GITHUB_DATA = {
  streak: "18 Days Active",
  commitsToday: 4,
  pullRequests: [
    { title: "feat: add multi-speaker TTS engine #12", status: "Merged", repo: "mk-assistant-bot" },
    { title: "fix: update Google Calendar sync timeout #14", status: "Open / Under Review", repo: "mk-assistant-bot" }
  ],
  issues: [
    { title: "Refactor Notion task sync database listener", status: "Active / Assigned", priority: "Medium" }
  ]
};

const MOCK_NOTION_TASKS = [
  { task: "Complete Leetcode Daily Challenge", status: "In Progress", list: "Coding Streak" },
  { task: "Revise Trie and Segment Trees notes", status: "To Do", list: "Exam Prep" },
  { task: "Refine LinkedIn summary & upload portfolio link", status: "Completed", list: "Connect & Career" },
  { task: "Draft cover letter draft for Stripe application", status: "To Do", list: "Job Applications" }
];

const MOCK_WEATHER = {
  temp: "74°F / 23°C",
  condition: "Bright and Sunny",
  recommendation: "Perfect, energetic weather! Good day for a light walk before exams. Wind is calm, grab a bottle of water before heading to the class."
};

const MOCK_CAREER_TRACKER = {
  examCountdown: "5 Days Left (Exams start on July 16, 2026)",
  placementRoadmap: "Stage 4: Advanced Graphs, Dynamic Programming & Low-Level Design (LLD)",
  courseraProgress: "Deep Learning Specialization - 82% (Course 4 of 5 in progress)",
  leetcodeProgress: "152 Problems Solved (58 Easy, 76 Medium, 18 Hard). Streak: 18 days active.",
  hackerrankProgress: "5-Star badge in Problem Solving & SQL."
};

const MOCK_CONNECT_NETWORK = {
  linkedin: "Connected with 3 recruiters from Google & NVIDIA. Sent follow-up portfolio notes.",
  resume: "My_Updated_Resume_2026.pdf (Verified & Optimized)",
  portfolio: "https://portfolio.mk.ai",
  internshipTracker: [
    { company: "Google", role: "Software Engineering Intern", status: "Applied / Resume Under Review" },
    { company: "NVIDIA", role: "AI Core Developer Intern", status: "Technical Round Scheduled for July 20" },
    { company: "Stripe", role: "Full-Stack Intern", status: "Preparing Cover Letter" }
  ]
};

const MOCK_EXPENSES = {
  totalWeekly: "$254.50",
  items: [
    { desc: "OpenAI API Usage", cost: "$42.10", date: "July 8" },
    { desc: "Gemini Pro Credits", cost: "$15.00", date: "July 9" },
    { desc: "AWS EC2 Hosting (Bot server)", cost: "$12.40", date: "July 10" },
    { desc: "Coffee & Tech Books", cost: "$185.00", date: "July 10" }
  ],
  excelFile: "expenses_july_2026.xlsx (Generated)"
};

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", geminiConfigured: !!ai });
});

// --- Gmail IMAP integration (per user) ---------------------------------
// Each logged-in user connects their own Gmail address + App Password
// (Google Account > Security > App Passwords — requires 2-Step Verification
// enabled). Stored in-memory on that user's own record; never echoed back.
app.post("/api/gmail/config", requireAuth, async (req: any, res) => {
  try {
    const rawEmail = req.body.email;
    const rawAppPassword = req.body.appPassword;
    if (!rawEmail || !rawAppPassword) {
      return res.status(400).json({ success: false, error: "Email and app password are required." });
    }

    // Google displays App Passwords as "abcd efgh ijkl mnop" for
    // readability; copy-pasting them (or an extra trailing space from the
    // input) must not break login, so strip all whitespace here. Trim the
    // email too in case of a stray leading/trailing space. We don't
    // second-guess the length here — Google's own IMAP server is the
    // source of truth on whether the credential is valid, not a guess
    // made in this code.
    const email = rawEmail.trim();
    const appPassword = rawAppPassword.replace(/\s+/g, "");

    // Verify the credentials actually work before saving them.
    const testConn = await imaps.connect({
      imap: {
        user: email,
        password: appPassword,
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { servername: "imap.gmail.com" }
      }
    });
    await testConn.end();

    // Credentials are verified — now try to persist them. Do this in its
    // own try/catch so a database problem is reported honestly instead of
    // being shown to the user as "Google rejected your credentials" (which
    // is what happened when this used to write to the wrong table).
    try {
      await updateUserGmailConfig(req.user.id, email, appPassword);
    } catch (dbErr: any) {
      console.error("Gmail config verified but failed to save:", dbErr?.message || dbErr);
      return res.status(500).json({
        success: false,
        error: `Gmail credentials were verified but couldn't be saved: ${dbErr?.message || dbErr}`
      });
    }

    req.user.gmail_email = email;
    req.user.gmail_app_password = appPassword;
    res.json({ success: true, email });
  } catch (err: any) {
    // Log the real reason server-side — the message shown to the user stays
    // generic/safe, but this is what you check in the server logs when
    // someone reports "correct credentials, still fails".
    console.error("Gmail IMAP connect failed:", err?.message || err);
    res.status(401).json({
      success: false,
      error: "Google rejected that email/password over IMAP. This isn't a rule this app made up — Gmail itself requires a 16-character App Password (not your normal login password) once 2-Step Verification is on. Reset your Google password at accounts.google.com/signin/recovery, or generate a fresh App Password at myaccount.google.com/apppasswords, then try again."
    });
  }
});

// Whether the logged-in user has Gmail IMAP connected (never returns the password).
app.get("/api/gmail/config/status", requireAuth, (req: any, res) => {
  res.json({
    configured: !!req.user.gmail_email,
    email: req.user.gmail_email || null
  });
});

// Remove the logged-in user's saved Gmail credentials.
app.delete("/api/gmail/config", requireAuth, async (req: any, res) => {
  try {
    await clearUserGmailConfig(req.user.id);
    req.user.gmail_email = null;
    req.user.gmail_app_password = null;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to disconnect Gmail: ${err?.message || err}` });
  }
});

// Fetch real unread Gmail messages via IMAP for the logged-in user, with the
// same priority / category heuristics the app previously ran on Gmail-API data.
app.get("/api/gmail/unread", requireAuth, async (req: any, res) => {
  const gmailConfig = req.user.gmail_email ? { email: req.user.gmail_email as string, appPassword: req.user.gmail_app_password as string } : null;
  if (!gmailConfig) {
    return res.status(400).json({
      success: false,
      error: "Gmail is not connected. Add your Gmail address and App Password first."
    });
  }

  let connection: imaps.ImapSimple | null = null;
  try {
    connection = await imaps.connect({
      imap: {
        user: gmailConfig.email,
        password: gmailConfig.appPassword,
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { servername: "imap.gmail.com" }
      }
    });

    await connection.openBox("INBOX");

    const searchCriteria = ["UNSEEN"];
    const fetchOptions = { bodies: [""], markSeen: false };
    let messages = await connection.search(searchCriteria, fetchOptions);

    // Fall back to the most recent messages if there are no unread ones.
    if (messages.length === 0) {
      const allFetchOptions = { bodies: [""], markSeen: false };
      const allMessages = await connection.search(["ALL"], allFetchOptions);
      messages = allMessages.slice(-5);
    } else {
      messages = messages.slice(0, 8);
    }

    const fetchedEmails = await Promise.all(
      messages.map(async (item) => {
        const rawBody = item.parts.find((part) => part.which === "")?.body || "";
        const parsed = await simpleParser(rawBody);

        const fromHeader = parsed.from?.text || "Unknown Sender";
        const subjectHeader = parsed.subject || "No Subject";
        const bodyText = (parsed.text || "").slice(0, 500);

        let displayTime = "Today";
        if (parsed.date) {
          const emailDate = new Date(parsed.date);
          const today = new Date();
          displayTime =
            emailDate.toDateString() === today.toDateString()
              ? emailDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : emailDate.toLocaleDateString([], { month: "short", day: "numeric" });
        }

        const lowerSubject = subjectHeader.toLowerCase();
        const lowerBody = bodyText.toLowerCase();

        let priority = "LOW";
        if (
          lowerSubject.includes("urgent") ||
          lowerSubject.includes("action required") ||
          lowerSubject.includes("important") ||
          lowerSubject.includes("alert") ||
          lowerBody.includes("approve") ||
          lowerBody.includes("critical")
        ) {
          priority = "HIGH";
        } else if (
          lowerSubject.includes("update") ||
          lowerSubject.includes("meeting") ||
          lowerSubject.includes("flight") ||
          lowerSubject.includes("confirm")
        ) {
          priority = "MEDIUM";
        }

        let category = "Personal";
        if (lowerSubject.includes("flight") || lowerSubject.includes("travel") || lowerSubject.includes("booking")) {
          category = "Travel";
        } else if (lowerSubject.includes("leetcode") || lowerSubject.includes("exam") || lowerSubject.includes("class")) {
          category = "Study";
        } else if (lowerSubject.includes("invoice") || lowerSubject.includes("receipt") || lowerSubject.includes("bill") || lowerSubject.includes("security")) {
          category = "Finance";
        } else if (lowerSubject.includes("job") || lowerSubject.includes("placement") || lowerSubject.includes("interview") || lowerSubject.includes("offer")) {
          category = "Placement";
        }

        return {
          id: parsed.messageId || `${Date.now()}-${Math.random()}`,
          sender: fromHeader,
          subject: subjectHeader,
          time: displayTime,
          priority,
          category,
          body: bodyText
        };
      })
    );

    res.json({ success: true, emails: fetchedEmails });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch Gmail messages." });
  } finally {
    if (connection) connection.end();
  }
});
// -----------------------------------------------------------------------

// Shared Gemini call used by BOTH /api/mk/chat (the in-app chat UI) and the
// Telegram webhook below. Pulled out so Telegram doesn't get a second,
// divergent AI client/prompt — same brain, two front doors.
async function askAssistant(userMessage: string, agentName: string, agentPersonality: string): Promise<string> {
  if (!ai) {
    return `⚠️ GEMINI_API_KEY isn't configured on the server, so I can't think right now. Ask whoever runs this bot to set it.`;
  }
  const isNewsQuery = userMessage.toLowerCase().includes("news") || userMessage.toLowerCase().includes("stock") || userMessage.toLowerCase().includes("latest") || userMessage.toLowerCase().includes("today");
  const contextData = `
- GMAIL MESSAGES (REAL OR SIMULATED):
${JSON.stringify(MOCK_EMAILS, null, 2)}
- GOOGLE CALENDAR & EVENTS (REAL OR SIMULATED):
${JSON.stringify(MOCK_CALENDAR, null, 2)}
- STUDENT CAREER & PROGRESS ROADMAP:
${JSON.stringify(MOCK_CAREER_TRACKER, null, 2)}
- WEEKLY EXPENSES:
${JSON.stringify(MOCK_EXPENSES, null, 2)}
- LOCAL WEATHER:
${JSON.stringify(MOCK_WEATHER, null, 2)}
  `;
  const systemPrompt = `
You are "${agentName}", a helpful personal AI assistant chatting with your boss over Telegram. Personality style: "${agentPersonality}".
Reply in plain conversational text (Telegram Markdown allowed: *bold*, _italic_, \`code\`) — NOT JSON, NOT a structured report.
Keep replies natural and reasonably short, the way a real assistant would text back, not a form.
Address the user as "Boss" occasionally, not every message.
Context you can reference if relevant:
${contextData}
`;
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    config: {
      systemInstruction: systemPrompt,
      tools: isNewsQuery ? [{ googleSearch: {} }] : undefined
    }
  });
  return response.text || "Sorry Boss, I didn't get a response that time — try again?";
}

// MK Assistant Chat Simulation Endpoint
app.post("/api/mk/chat", async (req, res) => {
  try {
    const { message, chatHistory, interests, newsTopic, customMockData, realEmails, realCalendar, knowledgeContext, assistantName, assistantPersonality } = req.body;

    const userMessage = message || "";
    const userInterests = Array.isArray(interests) ? interests : ["AI", "Tech", "Finance"];
    const preferredTopic = newsTopic || "AI";
    // Whoever the user has named their agent (e.g. "Ammu") — falls back to
    // "MK" for callers that don't pass one (e.g. the admin debug console).
    const agentName = (typeof assistantName === "string" && assistantName.trim()) ? assistantName.trim() : "MK";
    const agentPersonality = (typeof assistantPersonality === "string" && assistantPersonality.trim()) ? assistantPersonality.trim() : "Helpful Professional";

    // If Gemini is not initialized, return a simulated fallback response immediately
    if (!ai) {
      return res.json({
        thoughtSteps: [
          "Thought: Gemini API Key is missing. Initializing offline sandbox simulation mode.",
          "Tool Trigger: Loading Gmail database of messages...",
          "Tool Trigger: Loading news headlines for interests: " + userInterests.join(", "),
          "Process: Running priority-ranking scoring heuristics...",
          `Final Output: Crafting response in ${agentName}'s spoken style.`
        ],
        responseText: `⚠️ **[OFFLINE SANDBOX MODE]**\n\nBoss, I can't reach the full reasoning engine right now — set your **GEMINI_API_KEY** in your **.env** file to wake me up properly.\n\nHere's a simulated response to: "${userMessage}"\n\n**Morning Briefing (Simulated)**\n- Found 4 unread emails. 2 high priority flagged.\n- Top headlines matching your interest are ready.\n\n*Check the Code Hub tab to copy the complete Python source code and run ${agentName} locally on your own machine!*`
      });
    }
    const isBriefing = userMessage.trim().toLowerCase() === "/briefing" || userMessage.toLowerCase().includes("briefing");
    const isEmailQuery = userMessage.toLowerCase().includes("email") || userMessage.toLowerCase().includes("gmail") || userMessage.toLowerCase().includes("boss") || userMessage.toLowerCase().includes("mail");
    const isNewsQuery = userMessage.toLowerCase().includes("news") || userMessage.toLowerCase().includes("stock") || userMessage.toLowerCase().includes("nvidia") || userMessage.toLowerCase().includes("headline");
    const isCalendarQuery = userMessage.toLowerCase().includes("calendar") || userMessage.toLowerCase().includes("class") || userMessage.toLowerCase().includes("exam") || userMessage.toLowerCase().includes("deadline") || userMessage.toLowerCase().includes("countdown") || userMessage.toLowerCase().includes("schedule");
    const isDriveQuery = userMessage.toLowerCase().includes("drive") || userMessage.toLowerCase().includes("pdf") || userMessage.toLowerCase().includes("resume") || userMessage.toLowerCase().includes("file") || userMessage.toLowerCase().includes("certificate");
    const isGitHubQuery = userMessage.toLowerCase().includes("github") || userMessage.toLowerCase().includes("commit") || userMessage.toLowerCase().includes("pr") || userMessage.toLowerCase().includes("streak") || userMessage.toLowerCase().includes("issue");
    const isNotionQuery = userMessage.toLowerCase().includes("notion") || userMessage.toLowerCase().includes("note") || userMessage.toLowerCase().includes("task");
    const isWeatherQuery = userMessage.toLowerCase().includes("weather") || userMessage.toLowerCase().includes("forecast") || userMessage.toLowerCase().includes("rain") || userMessage.toLowerCase().includes("sunny");
    const isCareerQuery = userMessage.toLowerCase().includes("placement") || userMessage.toLowerCase().includes("roadmap") || userMessage.toLowerCase().includes("coursera") || userMessage.toLowerCase().includes("leetcode") || userMessage.toLowerCase().includes("hackerrank") || userMessage.toLowerCase().includes("preparation") || userMessage.toLowerCase().includes("prep");
    const isConnectQuery = userMessage.toLowerCase().includes("linkedin") || userMessage.toLowerCase().includes("portfolio") || userMessage.toLowerCase().includes("application") || userMessage.toLowerCase().includes("internship") || userMessage.toLowerCase().includes("company");
    const isExpensesQuery = userMessage.toLowerCase().includes("expense") || userMessage.toLowerCase().includes("cost") || userMessage.toLowerCase().includes("spend") || userMessage.toLowerCase().includes("excel") || userMessage.toLowerCase().includes("sheets") || userMessage.toLowerCase().includes("money");

    // We can run real Google Search Grounding to simulate live lookups for stock/news/weather queries
    const useGoogleSearch = isNewsQuery || userMessage.toLowerCase().includes("stock") || userMessage.toLowerCase().includes("latest") || userMessage.toLowerCase().includes("today");

    let contextData = `
=== CURRENT USER PERSONAL DATA ===
- News Interests: ${userInterests.join(", ")}
- News Topic: ${preferredTopic}

- GMAIL MESSAGES (REAL OR SIMULATED):
${JSON.stringify(realEmails || MOCK_EMAILS, null, 2)}

- GOOGLE CALENDAR & EVENTS (REAL OR SIMULATED):
${JSON.stringify(realCalendar || MOCK_CALENDAR, null, 2)}

- GOOGLE DRIVE FILES:
${JSON.stringify(MOCK_DRIVE_FILES, null, 2)}

- GITHUB DEVELOPER DATA:
${JSON.stringify(MOCK_GITHUB_DATA, null, 2)}

- NOTION NOTES & TASKS:
${JSON.stringify(MOCK_NOTION_TASKS, null, 2)}

- LOCAL WEATHER:
${JSON.stringify(MOCK_WEATHER, null, 2)}

- STUDENT CAREER & PROGRESS ROADMAP:
${JSON.stringify(MOCK_CAREER_TRACKER, null, 2)}

- CONNECTS, APPLICATIONS & INTERNSHIPS:
${JSON.stringify(MOCK_CONNECT_NETWORK, null, 2)}

- WEEKLY EXPENSES & SPREADSHEETS:
${JSON.stringify(MOCK_EXPENSES, null, 2)}
    `;

    if (knowledgeContext) {
      contextData += `\n- RETRIEVED SEMANTIC DOCUMENT KNOWLEDGE:\n${knowledgeContext}\n`;
    }

    // Let's call Gemini to construct a structured response
    const systemPrompt = `
You are simulating "${agentName}", an advanced Python-based Personal AI Assistant running as a Telegram Bot with LangChain. Your personality style is "${agentPersonality}".
Your goal is to simulate a complete multi-step 'Reasoning Agent' (LangChain AgentExecutor) that operates on the user's personal data.

The user can ask questions about:
1. Gmail: Read, prioritize, summarize, draft replies.
2. Google Calendar: Class schedules, upcoming exams, meetings, countdowns.
3. Google Drive: Search PDFs, notes, resumes, certificates instantly.
4. GitHub: Commits, PRs, issues, contribution streak.
5. Notion: Read notes, manage lists & tasks.
6. Weather: Local daily forecast and before-leaving recommendations.
7. Clock/Reminder: Alarms, timers, exam countdowns.
8. Student Dashboard: Placement preparation roadmap, Coursera course completion status, LeetCode / HackerRank streaks and problem-solving badges.
9. Connect Network: LinkedIn recruiter notes, Resume optimization status, Portfolio links, Internship application status tracker, Target company lists.
10. expenses & Local Commands: Generate Excel/CSV reports, track expenses, simulated PC control (e.g. system volume adjustments, opening website, terminal commands), visual screenshot reading, and voice speech synthesis.

When answering, you must return a structured JSON response matching the following guidelines:
1. "thoughtSteps": An array of strings mimicking the step-by-step thinking process of an agent executing tools. Each step should represent a clear logical state (e.g. "Thought: User asked to check their GitHub streak. Calling PyGithub connector Tool...", "Executing tool github_streak_check...", "Thought: Streak data received. Applying scoring..."). Showcase how the priority engine calculations are done or how local Python libraries are engaged. Make steps detailed, realistic, and highly professional.
2. "responseText": The final message that will be sent back to the user's Telegram chat, written the way you'd actually SPEAK it out loud to your boss, not like a typed report:
   - Always address the user as "Boss" — open with a short, natural spoken line first (e.g. "Boss, here's today's news..." or "Boss, you've got 2 urgent emails..."), the way a real personal assistant would greet them before diving into detail.
   - Keep the tone warm, direct, and conversational — plain spoken sentences, not stiff corporate phrasing.
   - After that spoken opening, you can still use bold (*word*), italic (_word_), or inline code (\`code\`) for important metrics, and section dividers (e.g. "━━━━ ✉️ URGENT EMAILS ━━━━") for longer structured info — but the response should always read like ${agentName} is genuinely talking to their boss, not printing a form.
   - Highlight priority scores or streak counts clearly.

Keep the simulated response highly realistic, accurate to the query, and formatted with premium styling.

Current user settings:
- User preferred news interests: ${userInterests.join(", ")}
- User focused news topic: ${preferredTopic}
- Context Data Provided:
${contextData}
`;

    const chatContent = [
      { role: "user", parts: [{ text: `User Message: "${userMessage}"\nRun the agent and return the response.` }] }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: chatContent,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thoughtSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Detailed step-by-step chain-of-thought of the Agent Executor running tools."
            },
            responseText: {
              type: Type.STRING,
              description: "The final beautifully structured Telegram markdown response for the user."
            }
          },
          required: ["thoughtSteps", "responseText"]
        },
        // Enable search grounding if user is asking about live news or stocks
        tools: useGoogleSearch ? [{ googleSearch: {} }] : undefined
      }
    });

    const parsedResponse = JSON.parse(response.text || "{}");
    res.json(parsedResponse);

  } catch (error: any) {
    console.error("Error in MK Simulator API:", error);
    res.status(500).json({
      thoughtSteps: ["Thought: An unexpected system error occurred in the simulation engine."],
      responseText: `❌ **Simulation Error:** ${error.message || "Something went wrong."}\n\nPlease verify that your GEMINI_API_KEY is correctly configured.`
    });
  }
});

// --- LAPTOP AGENT STATE ENGINE (REAL-WORLD C2 POLLING SCHEME) ---
interface LaptopState {
  cpu: number;
  ramTotal: string;
  ramUsed: string;
  diskTotal: string;
  diskUsed: string;
  volume: number;
  online: boolean;
  lastSync: string;
  processes: Array<{ name: string; pid: number; cpu: number }>;
  // NOTE: these field names must match exactly what the frontend reads
  // (src/App.tsx laptopStatus?.<field>) and what the companion agent sends
  // (src/code-templates.ts get_system_metrics()). Previously this interface
  // used modelName/cpuModel/osName/gpuModel while the frontend read
  // deviceName/processor/osModel/gpu — a real agent's data would never have
  // displayed correctly even once connected.
  deviceName?: string;
  osModel?: string;
  processor?: string;
  gpu?: string;
  battery?: string;
  architecture?: string;
  uptime?: string;
  localIp?: string;
  publicIp?: string;
}

// No hardware is seeded here. Real values only ever arrive via a POST to
// /api/laptop/sync from the actual companion agent running on the user's
// machine (see src/code-templates.ts). Until that first sync happens, every
// tenant is honestly "offline" with unknown specs — no placeholder hardware.
let laptopStates: Record<string, LaptopState> = {};

let pendingCommands: Record<string, Array<{ id: string; command: string; params: any }>> = {
  murali: []
};

let commandHistory: Record<string, Array<{ id: string; command: string; params: any; status: "pending" | "success" | "failed"; result?: string; timestamp: string; fileReady?: boolean; fileName?: string; fileSize?: number }>> = {
  murali: []
};

// Files fetched from the Laptop Companion, keyed by the commandId that
// requested them. In-memory only, same as everything else here — cleared
// on cold start. Kept separate from commandHistory so the (potentially
// large) base64 payload doesn't bloat the history list the dashboard polls.
const fetchedFiles: Record<string, { filename: string; mimeType: string; dataBase64: string; size: number; ownerId: string }> = {};

// Get current Laptop Agent status
app.get("/api/laptop/status/:userId", (req, res) => {
  const { userId } = req.params;
  const status = laptopStates[userId] || {
    cpu: 0, ramTotal: "N/A", ramUsed: "N/A", diskTotal: "N/A", diskUsed: "N/A", volume: 0, online: false, lastSync: "N/A", processes: []
  };
  const history = commandHistory[userId] || [];
  res.json({ status, history });
});

// Enqueue system command from SaaS dashboard
app.post("/api/laptop/command", (req, res) => {
  const { userId, command, params } = req.body;
  if (!userId || !command) {
    return res.status(400).json({ error: "Missing required fields userId or command" });
  }

  const cmdId = "cmd_" + Math.random().toString(36).substring(2, 9);
  const newCmd = { id: cmdId, command, params };
  
  if (!pendingCommands[userId]) pendingCommands[userId] = [];
  pendingCommands[userId].push(newCmd);

  if (!commandHistory[userId]) commandHistory[userId] = [];
  commandHistory[userId].unshift({
    id: cmdId,
    command,
    params,
    status: "pending",
    timestamp: new Date().toLocaleTimeString()
  });

  res.json({ success: true, message: "Command queued for Laptop Companion polling.", commandId: cmdId });
});

// Heartbeat sync invoked by the local Windows companion Python script
app.post("/api/laptop/sync", (req, res) => {
  const { userId, metrics } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId parameter" });
  }

  // Update online status and metrics
  laptopStates[userId] = {
    ...metrics,
    online: true,
    lastSync: new Date().toLocaleTimeString()
  };

  // Pull any pending commands
  const cmds = pendingCommands[userId] || [];
  pendingCommands[userId] = []; // Clear queue

  res.json({ status: "success", pendingCommands: cmds });
});

// Windows client returns execution outcomes. For "get_file" commands the
// companion packs the file as a JSON string into "result" (fileName,
// mimeType, sizeBytes, data) rather than a separate field — we detect that
// case, pull the base64 payload out into fetchedFiles (see below), and
// replace the stored "result" text with a short human-readable summary so
// the (potentially large) base64 blob never sits in the polled history list.
app.post("/api/laptop/command-result", (req, res) => {
  const { userId, commandId, success, result } = req.body;
  if (!userId || !commandId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (commandHistory[userId]) {
    const cmdIndex = commandHistory[userId].findIndex(c => c.id === commandId);
    if (cmdIndex !== -1) {
      const entry = commandHistory[userId][cmdIndex];
      entry.status = success ? "success" : "failed";
      entry.result = result;

      if (success && entry.command === "get_file" && typeof result === "string") {
        try {
          const parsed = JSON.parse(result);
          if (parsed && parsed.data && parsed.fileName) {
            const sizeBytes = parsed.sizeBytes || Buffer.byteLength(parsed.data, "base64");
            fetchedFiles[commandId] = {
              filename: parsed.fileName,
              mimeType: parsed.mimeType || "application/octet-stream",
              dataBase64: parsed.data,
              size: sizeBytes,
              ownerId: userId
            };
            entry.fileReady = true;
            entry.fileName = parsed.fileName;
            entry.fileSize = sizeBytes;
            entry.result = `File ready: ${parsed.fileName} (${(sizeBytes / 1024).toFixed(1)} KB)`;
          }
        } catch {
          // Not a file payload (e.g. "file not found" message) — leave
          // result as the plain text the companion sent.
        }
      }
    }
  }

  res.json({ status: "ok" });
});

// Download a file that was fetched from the user's own laptop. Scoped to
// the requesting user's own commands only — one visitor can't download
// another visitor's fetched files, since these are keyed by commandId and
// checked against the owner recorded when the file arrived.
app.get("/api/laptop/file/:userId/:commandId", (req, res) => {
  const { userId, commandId } = req.params;
  const file = fetchedFiles[commandId];
  if (!file || file.ownerId !== userId) {
    return res.status(404).json({ success: false, error: "File not found or no longer available." });
  }

  const buffer = Buffer.from(file.dataBase64, "base64");
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.filename)}"`);
  res.setHeader("Content-Length", buffer.length.toString());
  res.send(buffer);
});

// --- REAL-TIME NEWS AGENT FEED API ---
const NEWS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getCachedNews(): { articles: any[]; fetchedAt: number } | null {
  const row = db.prepare("SELECT articles_json, fetched_at FROM news_cache WHERE id = 1").get() as { articles_json: string; fetched_at: number } | undefined;
  if (!row) return null;
  return { articles: JSON.parse(row.articles_json), fetchedAt: row.fetched_at };
}

function setCachedNews(articles: any[]) {
  db.prepare(
    "INSERT INTO news_cache (id, articles_json, fetched_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET articles_json = excluded.articles_json, fetched_at = excluded.fetched_at"
  ).run(JSON.stringify(articles), Date.now());
}

async function fetchLiveNews(): Promise<any[]> {
  // Primary: saurav.tech NewsAPI mirror (free, no key, but occasionally down).
  try {
    const newsRes = await fetch("https://saurav.tech/NewsAPI/top-headlines/category/technology/in.json");
    if (newsRes.ok) {
      const data: any = await newsRes.json();
      const articles = (data.articles || []).map((art: any) => ({
        title: art.title || "No Title",
        source: art.source?.name || "Tech News India",
        description: art.description || "",
        url: art.url || "#",
        publishedAt: art.publishedAt || new Date().toISOString()
      }));
      if (articles.length > 0) return articles;
    }
  } catch (fetchErr) {
    console.warn("Primary news mirror failed:", fetchErr);
  }

  // Fallback: Hacker News top stories (real, free, no key, very reliable —
  // this is what actually shows up as "highlights" when the primary source
  // is unreachable, instead of an empty/fake result).
  try {
    const topIdsRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (topIdsRes.ok) {
      const ids: number[] = (await topIdsRes.json()).slice(0, 10);
      const items = await Promise.all(
        ids.map(id => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()).catch(() => null))
      );
      return items.filter(Boolean).map((it: any) => ({
        title: it.title || "No Title",
        source: "Hacker News",
        description: it.url ? new URL(it.url).hostname : "Discussion on Hacker News",
        url: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
        publishedAt: it.time ? new Date(it.time * 1000).toISOString() : new Date().toISOString()
      }));
    }
  } catch (fallbackErr) {
    console.warn("Hacker News fallback failed:", fallbackErr);
  }

  return [];
}

app.get("/api/news", async (req, res) => {
  try {
    const cached = getCachedNews();
    const isFresh = cached && (Date.now() - cached.fetchedAt) < NEWS_CACHE_TTL_MS;

    if (isFresh) {
      return res.json({ success: true, articles: cached!.articles, cachedAt: cached!.fetchedAt, source: "cache" });
    }

    const fresh = await fetchLiveNews();
    if (fresh.length > 0) {
      setCachedNews(fresh);
      return res.json({ success: true, articles: fresh, cachedAt: Date.now(), source: "live" });
    }

    // Both live fetch attempts failed. If we have ANY cache (even stale),
    // serve it rather than showing nothing — labeled honestly as stale.
    if (cached) {
      return res.json({ success: true, articles: cached.articles, cachedAt: cached.fetchedAt, source: "stale-cache" });
    }

    return res.json({ success: false, articles: [], error: "News source unavailable right now — no fake articles substituted." });
  } catch (err: any) {
    console.warn("News fetch failed:", err);
    res.json({ success: false, articles: [], error: "News source unavailable right now." });
  }
});

// --- [DELETED] "/api/laptop/simulate" — this endpoint faked a live laptop
// connection: it invented fake CPU/RAM movement, fabricated a fake
// `systeminfo` output for an "ASUSTeK ROG Zephyrus G14 / AMD Ryzen 9 5900HS
// / RTX 3060" that isn't your machine, and returned a fake generated .txt
// file for "get_file" instead of ever touching your real filesystem.
// Removed entirely per user request. The only legitimate way telemetry,
// command results, or files enter the system now is a real agent process
// running on your machine and POSTing to /api/laptop/sync and
// /api/laptop/command-result (see src/code-templates.ts for that script).

// Real-world Telegram Integration Broadcast API
// --- CALENDAR EVENTS (real, Postgres-backed — survives Vercel cold starts) ---
app.get("/api/calendar/events/:userId", async (req, res) => {
  try {
    const events = await pgGetCalendarEvents(req.params.userId);
    res.json({ events });
  } catch (err: any) {
    console.error("Get calendar events failed:", err);
    res.status(500).json({ error: err.message || "Failed to load calendar events." });
  }
});

app.post("/api/calendar/events", async (req, res) => {
  const { userId, date, title, type } = req.body;
  if (!userId || !date || !title) {
    return res.status(400).json({ error: "Missing required fields userId, date, or title" });
  }
  try {
    const newEvent = await pgCreateCalendarEvent(userId, date, title, type);
    const events = await pgGetCalendarEvents(userId);
    res.json({ success: true, event: newEvent, events });
  } catch (err: any) {
    console.error("Create calendar event failed:", err);
    res.status(500).json({ error: err.message || "Failed to create calendar event." });
  }
});

app.delete("/api/calendar/events/:userId/:eventId", async (req, res) => {
  const { userId, eventId } = req.params;
  try {
    await pgDeleteCalendarEvent(userId, eventId);
    const events = await pgGetCalendarEvents(userId);
    res.json({ success: true, events });
  } catch (err: any) {
    console.error("Delete calendar event failed:", err);
    res.status(500).json({ error: err.message || "Failed to delete calendar event." });
  }
});

// --- TASKS (real, Postgres-backed — survives Vercel cold starts) ---
app.get("/api/tasks/:userId", async (req, res) => {
  try {
    res.json({ tasks: await pgGetTasks(req.params.userId) });
  } catch (err: any) {
    console.error("Get tasks failed:", err);
    res.status(500).json({ error: err.message || "Failed to load tasks." });
  }
});

app.post("/api/tasks", async (req, res) => {
  const { userId, text, list } = req.body;
  if (!userId || !text) {
    return res.status(400).json({ error: "Missing required fields userId or text" });
  }
  try {
    await pgCreateTask(userId, text, list);
    res.json({ success: true, tasks: await pgGetTasks(userId) });
  } catch (err: any) {
    console.error("Create task failed:", err);
    res.status(500).json({ error: err.message || "Failed to create task." });
  }
});

app.put("/api/tasks/:userId/:taskId/toggle", async (req, res) => {
  const { userId, taskId } = req.params;
  try {
    const found = await pgToggleTask(userId, taskId);
    if (!found) return res.status(404).json({ error: "Task not found" });
    res.json({ success: true, tasks: await pgGetTasks(userId) });
  } catch (err: any) {
    console.error("Toggle task failed:", err);
    res.status(500).json({ error: err.message || "Failed to update task." });
  }
});

app.delete("/api/tasks/:userId/:taskId", async (req, res) => {
  const { userId, taskId } = req.params;
  try {
    await pgDeleteTask(userId, taskId);
    res.json({ success: true, tasks: await pgGetTasks(userId) });
  } catch (err: any) {
    console.error("Delete task failed:", err);
    res.status(500).json({ error: err.message || "Failed to delete task." });
  }
});

// --- EXPENSES (real, Postgres-backed — previously only "simulated" by the
// chat AI, nothing was ever actually stored) ---
app.get("/api/expenses/:userId", async (req, res) => {
  try {
    res.json({ expenses: await pgGetExpenses(req.params.userId) });
  } catch (err: any) {
    console.error("Get expenses failed:", err);
    res.status(500).json({ error: err.message || "Failed to load expenses." });
  }
});

app.post("/api/expenses", async (req, res) => {
  const { userId, description, cost, category } = req.body;
  if (!userId || !description || cost === undefined || cost === null) {
    return res.status(400).json({ error: "Missing required fields userId, description, or cost" });
  }
  const costNum = Number(cost);
  if (Number.isNaN(costNum)) return res.status(400).json({ error: "cost must be a number" });
  try {
    await pgCreateExpense(userId, description, costNum, category);
    res.json({ success: true, expenses: await pgGetExpenses(userId) });
  } catch (err: any) {
    console.error("Create expense failed:", err);
    res.status(500).json({ error: err.message || "Failed to create expense." });
  }
});

app.delete("/api/expenses/:userId/:expenseId", async (req, res) => {
  const { userId, expenseId } = req.params;
  try {
    await pgDeleteExpense(userId, expenseId);
    res.json({ success: true, expenses: await pgGetExpenses(userId) });
  } catch (err: any) {
    console.error("Delete expense failed:", err);
    res.status(500).json({ error: err.message || "Failed to delete expense." });
  }
});

// --- STUDY / ROADMAP METRICS (real, SQLite-backed — replaces the old
// "save to local state only, gone on refresh" behavior) ---
app.get("/api/study/:userId", (req, res) => {
  const row = db.prepare("SELECT progress, leetcode, exam_countdown FROM study_metrics WHERE user_id = ?").get(req.params.userId) as { progress: number; leetcode: string; exam_countdown: string } | undefined;
  if (!row) return res.json({ configured: false, study: null });
  res.json({ configured: true, study: { progress: row.progress, leetcode: row.leetcode, examCountdown: row.exam_countdown } });
});

app.post("/api/study", (req, res) => {
  const { userId, progress, leetcode, examCountdown } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing required field userId" });
  db.prepare(
    `INSERT INTO study_metrics (user_id, progress, leetcode, exam_countdown, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET progress = excluded.progress, leetcode = excluded.leetcode, exam_countdown = excluded.exam_countdown, updated_at = excluded.updated_at`
  ).run(userId, progress ?? 0, leetcode || "Not Set", examCountdown || "Not Set", Date.now());
  res.json({ success: true, study: { progress: progress ?? 0, leetcode: leetcode || "Not Set", examCountdown: examCountdown || "Not Set" } });
});

// --- LOCATION (opt-in only) ---
// Written only from the frontend's weather feature, and only after the
// user's own browser has already shown them the native "Allow location?"
// permission prompt (see requestLiveLocationWeather in App.tsx). Nothing
// tracks location silently or in the background.
app.post("/api/location", (req, res) => {
  const { userId, label, lat, lon } = req.body;
  if (!userId || !label) return res.status(400).json({ error: "Missing required fields userId or label" });
  db.prepare(
    `INSERT INTO user_location (user_id, label, lat, lon, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET label = excluded.label, lat = excluded.lat, lon = excluded.lon, updated_at = excluded.updated_at`
  ).run(userId, label, lat ?? null, lon ?? null, Date.now());
  res.json({ success: true });
});

// --- KNOWLEDGE BASE / DOCUMENTS (real upload, real text extraction) ---
interface DocRow {
  id: string;
  filename: string;
  category: string;
  size_bytes: number;
  mime_type: string;
  created_at: number;
}

function getDocuments(userId: string): DocRow[] {
  return db.prepare(
    "SELECT id, filename, category, size_bytes, mime_type, created_at FROM document_knowledge WHERE user_id = ? ORDER BY created_at DESC"
  ).all(userId) as DocRow[];
}

app.get("/api/documents/:userId", (req, res) => {
  res.json({ documents: getDocuments(req.params.userId) });
});

// ---------------------------------------------------------------------------
// LARGE FILE UPLOADS (real fix for the 4MB/4.5MB wall above): the browser
// uploads the file bytes DIRECTLY to Vercel Blob storage, never through this
// serverless function — so Vercel's 4.5MB request-body cap never applies.
// This function's only job is (1) hand out a short-lived upload token, and
// (2) after the browser finishes, fetch the (now-hosted) file itself to run
// text extraction and save the DB row. Both of those requests are tiny.
//
// REQUIRES: a Blob store connected to this Vercel project (Vercel dashboard
// → Storage → create/connect a Blob store), which sets BLOB_READ_WRITE_TOKEN
// automatically. Without that env var, uploads will fail with a clear error
// telling you so, rather than the previous silent "Failed to upload file."
// ---------------------------------------------------------------------------
const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json"
];
const MAX_BLOB_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB — matches what the UI has always claimed.

app.post("/api/documents/blob-upload", async (req, res) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: "File storage isn't configured on the server yet. In the Vercel dashboard, go to Storage → create/connect a Blob store to this project, then redeploy." });
  }
  const body = req.body as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request: req as any,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_UPLOAD_MIME_TYPES,
        maximumSizeInBytes: MAX_BLOB_UPLOAD_BYTES,
        addRandomSuffix: true
      }),
      onUploadCompleted: async ({ blob }) => {
        // Vercel calls this via webhook once the blob is confirmed stored —
        // only reachable when this deployment has a public URL (not local
        // dev). The actual DB save doesn't depend on this: the client calls
        // /api/documents/finalize explicitly right after upload() resolves,
        // which works in every environment. This is just a log for visibility.
        console.log("[blob-upload] Confirmed stored:", blob.url);
      }
    });
    res.json(jsonResponse);
  } catch (err: any) {
    console.error("Blob upload token generation failed:", err);
    res.status(400).json({ error: err.message || "Failed to authorize upload." });
  }
});

app.post("/api/documents/finalize", async (req, res) => {
  try {
    const { userId, category, blobUrl, filename, size, mimeType } = req.body;
    if (!userId || !blobUrl || !filename) {
      return res.status(400).json({ error: "Missing required fields userId, blobUrl, or filename" });
    }
    // Fetch the file back from Blob storage server-side (a tiny/no-op
    // request from this function's perspective, unlike the original upload)
    // so we can extract its text for Q&A, same as the small-file path does.
    let text = "";
    try {
      const blobRes = await fetch(blobUrl);
      const arrayBuffer = await blobRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      text = await extractTextFromFile({ buffer, originalname: filename, mimetype: mimeType, size: buffer.length } as any);
    } catch (extractErr) {
      console.warn("Text extraction failed for large upload (file is still saved, just not searchable via Q&A):", extractErr);
    }
    const id = "doc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    db.prepare(
      "INSERT INTO document_knowledge (id, user_id, filename, category, size_bytes, mime_type, extracted_text, blob_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, userId, filename, category || "Other", size || 0, mimeType || "application/octet-stream", text, blobUrl, Date.now());
    res.json({
      success: true,
      document: { id, filename, category: category || "Other", size_bytes: size || 0, mime_type: mimeType, created_at: Date.now() },
      textExtracted: text.length > 0,
      documents: getDocuments(userId)
    });
  } catch (err: any) {
    console.error("Finalize large upload failed:", err);
    res.status(500).json({ error: err.message || "Failed to save uploaded file." });
  }
});

app.post("/api/documents/upload", (req, res, next) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: `File too large. Max upload size is ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)}MB.` });
      }
      console.error("Upload middleware error:", err);
      return res.status(400).json({ error: err.message || "Upload failed." });
    }
    next();
  });
}, async (req, res) => {
  try {
    const userId = req.body.userId;
    const category = req.body.category || "Other";
    const file = req.file;
    if (!userId || !file) {
      return res.status(400).json({ error: "Missing required fields userId or file" });
    }
    const text = await extractTextFromFile(file);
    const id = "doc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    // Store the actual file bytes too (not just extracted text) so the file
    // can genuinely be opened/downloaded later — previously only the text
    // was kept, so "opening" a file never showed the real file, only a Q&A
    // panel over its text.
    const fileDataBase64 = file.buffer ? file.buffer.toString("base64") : null;
    db.prepare(
      "INSERT INTO document_knowledge (id, user_id, filename, category, size_bytes, mime_type, extracted_text, file_data_base64, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, userId, file.originalname, category, file.size, file.mimetype, text, fileDataBase64, Date.now());
    res.json({
      success: true,
      document: { id, filename: file.originalname, category, size_bytes: file.size, mime_type: file.mimetype, created_at: Date.now() },
      textExtracted: text.length > 0,
      documents: getDocuments(userId)
    });
  } catch (err: any) {
    console.error("Document upload failed:", err);
    res.status(500).json({ error: err.message || "Upload failed on the server." });
  }
});

app.delete("/api/documents/:userId/:docId", (req, res) => {
  const { userId, docId } = req.params;
  db.prepare("DELETE FROM document_knowledge WHERE id = ? AND user_id = ?").run(docId, userId);
  res.json({ success: true, documents: getDocuments(userId) });
});

// Serves the actual uploaded file back (real bytes, not just extracted
// text) so a click on a file in the Knowledge Base genuinely opens/downloads
// that file — in any browser, desktop or mobile, since this is just a
// normal HTTP response with the right Content-Type. Browsers that can
// render the type natively (PDF, images, text) show it inline; others
// download it.
app.get("/api/documents/:userId/:docId/file", (req, res) => {
  const { userId, docId } = req.params;
  const row = db.prepare(
    "SELECT filename, mime_type, file_data_base64, blob_url FROM document_knowledge WHERE id = ? AND user_id = ?"
  ).get(docId, userId) as { filename: string; mime_type: string | null; file_data_base64: string | null; blob_url: string | null } | undefined;
  if (!row) return res.status(404).json({ error: "Document not found" });
  // Large uploads live in Blob storage — just redirect the browser there
  // directly, it serves the real file with correct headers on its own.
  if (row.blob_url) return res.redirect(row.blob_url);
  if (!row.file_data_base64) {
    return res.status(404).json({ error: "Original file bytes weren't stored for this document (uploaded before this feature existed) — only its extracted text is available." });
  }
  const buffer = Buffer.from(row.file_data_base64, "base64");
  res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(row.filename)}"`);
  res.send(buffer);
});

// Returns the real extracted text for a document (used by chat RAG lookup).
app.get("/api/documents/:userId/:docId/text", (req, res) => {
  const { userId, docId } = req.params;
  const row = db.prepare("SELECT filename, extracted_text FROM document_knowledge WHERE id = ? AND user_id = ?").get(docId, userId) as { filename: string; extracted_text: string } | undefined;
  if (!row) return res.status(404).json({ error: "Document not found" });
  res.json({ filename: row.filename, text: row.extracted_text });
});

// Real Q&A against a specific document's actual extracted text, via Gemini.
app.post("/api/documents/query", async (req, res) => {
  const { userId, docId, question } = req.body;
  if (!userId || !docId || !question) {
    return res.status(400).json({ error: "Missing required fields userId, docId, or question" });
  }
  const row = db.prepare("SELECT filename, extracted_text FROM document_knowledge WHERE id = ? AND user_id = ?").get(docId, userId) as { filename: string; extracted_text: string } | undefined;
  if (!row) return res.status(404).json({ error: "Document not found" });
  if (!row.extracted_text.trim()) {
    return res.json({ answer: `No extractable text was found in "${row.filename}" (unsupported file type or empty document), so I can't answer questions about its content yet.` });
  }
  if (!ai) {
    return res.status(503).json({ error: "GEMINI_API_KEY not configured on the server." });
  }
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are answering a question about the document "${row.filename}" using ONLY the text below. If the answer isn't in the text, say so.\n\n--- DOCUMENT TEXT ---\n${row.extracted_text.slice(0, 30000)}\n--- END DOCUMENT TEXT ---\n\nQuestion: ${question}`
    });
    res.json({ answer: result.text || "No answer generated." });
  } catch (err) {
    console.warn("Document query failed:", err);
    res.status(500).json({ error: "Failed to query document." });
  }
});

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
    const data = await response.json();
    if (data.ok) return { ok: true };
    return { ok: false, error: data.description || "Telegram API rejected message." };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to contact Telegram API." };
  }
}

app.post("/api/telegram/broadcast", async (req, res) => {
  const { token, chatId, text } = req.body;
  if (!token || !chatId || !text) {
    return res.status(400).json({ error: "Missing required parameters token, chatId, or text" });
  }
  const result = await sendTelegramMessage(token, chatId, text);
  if (result.ok) {
    res.json({ success: true, message: "Alert dispatched to real Telegram client!" });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

// ---------------------------------------------------------------------------
// REAL TELEGRAM WEBHOOK — this is the piece that was entirely missing.
// Everything above this comment can only SEND to Telegram (broadcast,
// automations). Telegram will never call any of that on its own. For the
// bot to receive and reply to messages, Telegram needs a URL to push every
// incoming update to — that's this route. Register it once (see the curl
// command in setup notes) and Telegram POSTs here every time someone
// messages the bot.
//
// Auth model: Telegram webhooks carry no session/login. We identify WHICH
// app user a message belongs to by matching the incoming chat.id against
// whichever user saved that chat ID via /api/telegram/config. If no user
// has that chat ID configured yet, we still reply (so /start works before
// setup), just without personal context.
// ---------------------------------------------------------------------------
app.post("/api/telegram/webhook", async (req, res) => {
  // Telegram requires a fast 200 OK regardless of what we do with the
  // update, or it will retry/backoff and eventually stop delivering.
  res.status(200).json({ ok: true });

  try {
    const update = req.body;

    // Ignore anything that isn't a plain text message (edited messages,
    // channel posts, callback queries, stickers, etc) — safely, not silently
    // crashing on shapes we don't handle.
    const message = update?.message;
    if (!message || typeof message.text !== "string") {
      console.log("[telegram webhook] Ignoring non-text update:", update?.update_id);
      return;
    }

    const chatId: string = String(message.chat?.id ?? "");
    const fromUserId: number | undefined = message.from?.id;
    const username: string | undefined = message.from?.username;
    const text: string = message.text.trim();

    if (!chatId) {
      console.warn("[telegram webhook] Update had no chat.id, dropping:", update?.update_id);
      return;
    }

    console.log(`[telegram webhook] chat=${chatId} user=${username || fromUserId} text="${text}"`);

    // Figure out which bot token to reply with. We're single-tenant in
    // practice (one bot, one owner), so we look up whichever app user has
    // this exact chatId configured and use THEIR saved token. If nobody
    // has configured this chat yet, fall back to a server-wide
    // TELEGRAM_BOT_TOKEN env var so /start still works pre-setup.
    const owner = await findUserByTelegramChatId(chatId);
    const token = owner?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error("[telegram webhook] No bot token available (no owner configured, no TELEGRAM_BOT_TOKEN env var) — cannot reply.");
      return;
    }

    const agentName = "MK";
    const agentPersonality = "Helpful Professional";

    // --- Command handling ---
    const command = text.split(" ")[0].toLowerCase();
    let replyText: string | null = null;

    if (command === "/start") {
      replyText =
        `🤖 *MK AI Assistant*\n\nHello ${owner?.name || "there"} 👋\n\nEverything is synchronized successfully.\n\n✔ Telegram Connected\n✔ AI Assistant Online\n✔ Notification Service Active\n\nJust send me a normal message anytime — I'll reply using the AI backend. Try /help to see commands.`;
    } else if (command === "/help") {
      replyText =
        `Here's what I can do, Boss:\n\n` +
        `/weather — quick weather check-in\n` +
        `/briefing — your morning briefing (email/news/calendar summary)\n` +
        `/status — quick system status\n\n` +
        `Or just talk to me normally — "what's on my calendar today?", "how are you?", anything.`;
    } else if (command === "/status") {
      replyText =
        `✅ *System Status*\nTelegram: Connected\nAI Backend: ${ai ? "Online" : "GEMINI_API_KEY missing"}\nLinked account: ${owner ? owner.email : "Not linked yet — configure Telegram in the app to link this chat."}`;
    } else if (command === "/weather" || command === "/briefing") {
      // Both route through the same AI brain as free-text — the AI already
      // knows how to answer these from context, we just forward the intent.
      try {
        replyText = await askAssistant(text, agentName, agentPersonality);
      } catch (err: any) {
        console.error("[telegram webhook] AI call failed for command:", command, err);
        replyText = `Sorry Boss, I hit an error pulling that up: ${err?.message || err}`;
      }
    } else {
      // Anything else: normal conversational message → AI backend.
      try {
        replyText = await askAssistant(text, agentName, agentPersonality);
      } catch (err: any) {
        console.error("[telegram webhook] AI call failed:", err);
        replyText = `Sorry Boss, something went wrong reaching the AI backend: ${err?.message || err}`;
      }
    }

    if (replyText) {
      const sent = await sendTelegramMessage(token, chatId, replyText);
      if (!sent.ok) {
        console.error("[telegram webhook] Failed to send reply:", sent.error);
      }
    }
  } catch (err: any) {
    // We've already responded 200 to Telegram above, so this is purely for
    // server-side visibility — never let a webhook throw block the ack.
    console.error("[telegram webhook] Unhandled error processing update:", err);
  }
});

// Save the user's Telegram bot token + chat ID (used so the webhook can
// match incoming messages to this user, and so the token/chatId persist
// across page reloads instead of the fields going blank every time).
//
// NOTE: this previously required `requireAuth` (a Bearer-token session
// check), but nothing in this frontend ever logs in or sends an
// Authorization header anywhere in the app — every other endpoint here
// (documents, laptop, tasks) takes userId directly in the URL instead.
// requireAuth therefore always returned 401 for real browser use, which is
// why saving/loading Telegram config silently never worked. Matching the
// rest of the app's actual auth model fixes it.
app.post("/api/telegram/config/:userId", async (req, res) => {
  const { userId } = req.params;
  const { token, chatId } = req.body;
  if (!token || !chatId) return res.status(400).json({ error: "Missing required fields token or chatId" });
  try {
    await setTelegramConfig(userId, token, chatId);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Save telegram config failed:", err);
    res.status(500).json({ error: err.message || "Failed to save Telegram config." });
  }
});

app.get("/api/telegram/config/:userId/status", async (req, res) => {
  try {
    const cfg = await getTelegramConfig(req.params.userId);
    res.json({ configured: !!(cfg.token && cfg.chatId), token: cfg.token || null, chatId: cfg.chatId || null });
  } catch (err: any) {
    console.error("Get telegram config failed:", err);
    res.status(500).json({ error: err.message || "Failed to load Telegram config." });
  }
});

// Health check: confirms the process is up AND that SQLite actually opened
// and can be queried. If better-sqlite3's native binary fails to load in a
// given deployment environment (the most common reason every DB-touching
// route — including /api/admin/verify — would break at once), this
// endpoint reports it clearly instead of every route failing silently.
app.get("/api/debug/users", async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      is_device_guest: u.is_device_guest,
      gmail_email: u.gmail_email,
      has_gmail_password: !!u.gmail_app_password
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health/db", async (req, res) => {
  try {
    const users = await listUsers();
    res.json({ ok: true, dbConnected: true, userCount: users.length });
  } catch (err: any) {
    console.error("Health check DB failure:", err);
    res.status(500).json({ ok: false, dbConnected: false, error: err.message || "Database unavailable." });
  }
});

// Global JSON error handler — MUST be registered last. Without this,
// Express's default error handler returns an HTML page for any route that
// throws (e.g. a DB error). The frontend then calls res.json() on that HTML
// page, which throws a parse error caught by the frontend's own try/catch,
// surfacing as a generic "Could not reach the server" message that hides
// the real problem. This guarantees every error response is real JSON.
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled route error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, error: err?.message || "Internal server error." });
});

export default app;
