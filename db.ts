// ============================================================================
// USER STORE: Postgres (persistent, survives cold starts/redeploys)
// EVERYTHING ELSE (tasks, calendar, documents, expenses, study metrics):
// still local SQLite. That data was never the concern here — only the user
// accounts (name/email/password/Gmail config) needed real persistence, so
// only that part lives in Postgres. This matters for Vercel: /tmp is wiped
// between cold starts, so a SQLite-only "users" table would silently forget
// every signup. A real Postgres database does not have that problem.
//
// This previously ran on Firebase Realtime Database, which required a
// service-account PEM private key as an env var — a format that's very easy
// to mangle when copy-pasting into a host's dashboard (wrapping quotes,
// literal "\n" vs real newlines, etc), and which caused hard-to-diagnose
// "Auth check failed: Realtime Database unavailable" errors. Plain SQL via
// a standard Postgres connection string (DATABASE_URL) avoids that whole
// class of problem — set one env var, no key material to normalize.
//
// SETUP: create a free Postgres database (Neon, Supabase, Vercel Postgres,
// Railway, etc all work) and set DATABASE_URL (or POSTGRES_URL) to its
// connection string, e.g.
//   postgres://user:password@host:5432/dbname?sslmode=require
// The `users` table is created automatically on first use — no manual
// migration needed.
//
// NOTE ON LOCATION: this file does NOT store or expose any per-user
// location/geolocation data anywhere, and none should be added here. The
// admin panel must never show a live/stored location tied to a user's
// account across all users.
// ============================================================================

import Database from "better-sqlite3";
import path from "path";
import { Pool } from "pg";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Local SQLite: unchanged responsibility — tasks, calendar, documents,
// expenses, study metrics, and short-lived sessions/device mappings. None of
// this is what needed persistence; it's fine if it resets on cold start.
// ---------------------------------------------------------------------------
function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "mkagent.db");
  }
  return path.join(process.cwd(), "mkagent.db");
}

const DB_PATH = resolveDbPath();

let dbInstance: Database.Database;
try {
  dbInstance = new Database(DB_PATH);
  dbInstance.pragma("journal_mode = WAL");

  dbInstance.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS device_sessions (
  device_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  list TEXT NOT NULL DEFAULT 'Inbox',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Personal',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_knowledge (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  size_bytes INTEGER NOT NULL,
  mime_type TEXT,
  extracted_text TEXT,
  file_data_base64 TEXT,
  blob_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  cost REAL NOT NULL,
  date TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS study_metrics (
  user_id TEXT PRIMARY KEY,
  progress INTEGER NOT NULL DEFAULT 0,
  leetcode TEXT,
  exam_countdown TEXT,
  updated_at INTEGER NOT NULL
);

-- Self-serve only: written after the user's OWN browser grants the native
-- geolocation prompt, read back only to that same user's own weather
-- widget. Never queried by the admin routes — do not add it back there.
CREATE TABLE IF NOT EXISTS user_location (
  user_id TEXT PRIMARY KEY,
  label TEXT,
  lat REAL,
  lon REAL,
  updated_at INTEGER NOT NULL
);

-- Simple single-row cache for /api/news (api/_lib/app.ts). Fine to live on
-- SQLite/reset on cold start — it's just a cache, real news gets re-fetched
-- live if it's missing. This table was referenced by app.ts's
-- getCachedNews()/setCachedNews() but never created, so every /api/news
-- request was throwing "no such table: news_cache" before it ever even
-- attempted a live fetch — that's why news always showed empty.
CREATE TABLE IF NOT EXISTS news_cache (
  id INTEGER PRIMARY KEY,
  articles_json TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
`);
  console.log(`[db] SQLite ready at ${DB_PATH}`);
} catch (err: any) {
  console.error(`[db] FAILED to open/init SQLite at ${DB_PATH}:`, err?.message || err);
  dbInstance = new Proxy({} as Database.Database, {
    get() {
      throw new Error(`Database unavailable (failed to open ${DB_PATH}): ${err?.message || err}`);
    }
  });
}

export const db = dbInstance;

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Postgres: the persistent user store. Requires DATABASE_URL (or
// POSTGRES_URL) as an env var — a standard Postgres connection string from
// your database provider (Vercel → Settings → Environment Variables).
// ---------------------------------------------------------------------------
const PG_CONNECTION_STRING =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

let pgPool: Pool | null = null;
let usersTableReady: Promise<void> | null = null;

// Most hosted Postgres providers (Neon, Supabase, Render, Railway, Vercel
// Postgres) require SSL and hand out connection strings without an explicit
// sslmode. Default to SSL on, but respect an explicit "sslmode=disable" and
// skip it for local databases.
function needsSSL(connectionString: string): boolean {
  if (/sslmode=disable/i.test(connectionString)) return false;
  if (/localhost|127\.0\.0\.1/i.test(connectionString)) return false;
  return true;
}

function buildPool(): Pool {
  if (!PG_CONNECTION_STRING) {
    throw new Error(
      "Missing DATABASE_URL (or POSTGRES_URL) env var. Set it to a Postgres " +
      "connection string from your database provider (Neon, Supabase, Vercel " +
      "Postgres, Railway, etc), e.g. " +
      "postgres://user:password@host:5432/dbname?sslmode=require"
    );
  }
  return new Pool({
    connectionString: PG_CONNECTION_STRING,
    ssl: needsSSL(PG_CONNECTION_STRING) ? { rejectUnauthorized: false } : undefined,
    max: 5
  });
}

// Lazily connects and ensures the `users` table exists, caching the result.
// Kept lazy (rather than run at import time) so a misconfigured/missing
// DATABASE_URL doesn't crash the whole serverless function on cold start —
// it instead surfaces as a clear error on the specific request that needed
// the user store, exactly like the rest of this app's error handling.
async function getUsersTable(): Promise<Pool> {
  if (!pgPool) {
    pgPool = buildPool();
    pgPool.on("error", (err) => {
      // Idle client errors (e.g. connection dropped) shouldn't crash the
      // process — just log them; the next query will reconnect a client.
      console.error("[db] Postgres pool error:", err?.message || err);
    });
  }
  if (!usersTableReady) {
    usersTableReady = pgPool
      .query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          is_admin BOOLEAN NOT NULL DEFAULT FALSE,
          is_device_guest BOOLEAN NOT NULL DEFAULT FALSE,
          gmail_email TEXT,
          gmail_app_password TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `)
      .then(() =>
        pgPool!.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));`
        )
      )
      .then(() => {
        console.log("[db] Postgres user store ready.");
      })
      .catch((err) => {
        // Allow a retry on the next call instead of caching a permanent
        // failure (e.g. the database was briefly unreachable).
        usersTableReady = null;
        const message = err?.message || String(err);
        console.error("[db] FAILED to initialize Postgres users table:", message);
        throw new Error(`User database unavailable: ${message}`);
      });
  }
  await usersTableReady;
  return pgPool;
}

export const dbReady: Promise<void> = Promise.resolve();

export interface UserDoc {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  is_admin: boolean;
  is_device_guest: boolean;
  gmail_email: string | null;
  gmail_app_password: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  created_at: string;
}

function rowToUserDoc(row: any): UserDoc {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    password_salt: row.password_salt,
    is_admin: !!row.is_admin,
    is_device_guest: !!row.is_device_guest,
    gmail_email: row.gmail_email ?? null,
    gmail_app_password: row.gmail_app_password ?? null,
    telegram_bot_token: row.telegram_bot_token ?? null,
    telegram_chat_id: row.telegram_chat_id ?? null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export async function createUser(
  name: string,
  email: string,
  password: string,
  isAdmin: boolean,
  isDeviceGuest = false
): Promise<UserDoc> {
  const pool = await getUsersTable();
  const salt = crypto.randomBytes(16).toString("hex");
  const user: UserDoc = {
    id: crypto.randomUUID(),
    name,
    email: email.toLowerCase().trim(),
    password_hash: hashPassword(password, salt),
    password_salt: salt,
    is_admin: isAdmin,
    is_device_guest: isDeviceGuest,
    gmail_email: null,
    gmail_app_password: null,
    telegram_bot_token: null,
    telegram_chat_id: null,
    created_at: new Date().toISOString()
  };
  await pool.query(
    `INSERT INTO users
       (id, name, email, password_hash, password_salt, is_admin, is_device_guest, gmail_email, gmail_app_password, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      user.id,
      user.name,
      user.email,
      user.password_hash,
      user.password_salt,
      user.is_admin,
      user.is_device_guest,
      user.gmail_email,
      user.gmail_app_password,
      user.created_at
    ]
  );
  return user;
}

export async function findUserByEmail(email: string): Promise<UserDoc | undefined> {
  const pool = await getUsersTable();
  const normalized = email.toLowerCase().trim();
  const { rows } = await pool.query(`SELECT * FROM users WHERE lower(email) = $1 LIMIT 1`, [normalized]);
  return rows[0] ? rowToUserDoc(rows[0]) : undefined;
}

export async function findUserById(id: string): Promise<UserDoc | undefined> {
  const pool = await getUsersTable();
  const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ? rowToUserDoc(rows[0]) : undefined;
}

export async function listUsers(): Promise<UserDoc[]> {
  const pool = await getUsersTable();
  const { rows } = await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
  return rows.map(rowToUserDoc);
}

export async function updateUserPassword(id: string, password: string): Promise<void> {
  const pool = await getUsersTable();
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  await pool.query(`UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3`, [hash, salt, id]);
}

export async function deleteUser(id: string): Promise<void> {
  const pool = await getUsersTable();
  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
}

// Persist a user's Gmail IMAP config (email + App Password). Previously this
// was written via `db.prepare("UPDATE users ...")` against the LOCAL SQLITE
// database — but that database's schema (above) has no `users` table at all,
// since user accounts live in the persistent store. That query was silently
// throwing on every save, which is why Gmail credentials never actually
// persisted. Routes now call this instead.
export async function updateUserGmailConfig(id: string, email: string, appPassword: string): Promise<void> {
  const pool = await getUsersTable();
  await pool.query(`UPDATE users SET gmail_email = $1, gmail_app_password = $2 WHERE id = $3`, [email, appPassword, id]);
}

export async function clearUserGmailConfig(id: string): Promise<void> {
  const pool = await getUsersTable();
  await pool.query(`UPDATE users SET gmail_email = NULL, gmail_app_password = NULL WHERE id = $1`, [id]);
}

export { hashPassword };

// ---------------------------------------------------------------------------
// CORE POSTGRES TABLES: tasks, calendar_events, expenses, automations.
// Moved off SQLite for the same reason `users` was: Vercel wipes /tmp on
// every cold start, so SQLite-only tasks/calendar/expenses were silently
// getting wiped. These now live in the same persistent Postgres database as
// users, keyed by DATABASE_URL/POSTGRES_URL. No new env var needed if you
// already set one up for the user store.
// ---------------------------------------------------------------------------
let coreTablesReady: Promise<void> | null = null;

async function getCorePool(): Promise<Pool> {
  // Ensures pgPool exists AND the `users` table exists first, since the
  // telegram config columns below are added onto that table.
  await getUsersTable();
  const pool = pgPool!;
  if (!coreTablesReady) {
    coreTablesReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          text TEXT NOT NULL,
          done BOOLEAN NOT NULL DEFAULT FALSE,
          list TEXT NOT NULL DEFAULT 'Studies',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS calendar_events (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          date TEXT NOT NULL,
          title TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'Personal',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          description TEXT NOT NULL,
          cost NUMERIC NOT NULL,
          category TEXT NOT NULL DEFAULT 'General',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
        CREATE TABLE IF NOT EXISTS document_upload_chunks (
          session_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          data_base64 TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (session_id, chunk_index)
        );
      `)
      .then(() => {
        console.log("[db] Core Postgres tables ready (tasks/calendar/expenses/upload chunks).");
      })
      .catch((err) => {
        coreTablesReady = null;
        const message = err?.message || String(err);
        console.error("[db] FAILED to init core Postgres tables:", message);
        throw new Error(`Core database unavailable: ${message}`);
      });
  }
  await coreTablesReady;
  return pool;
}

function newRandomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// --- Tasks ---
export interface TaskDoc { id: string; text: string; done: boolean; list: string; }

export async function getTasks(userId: string): Promise<TaskDoc[]> {
  const pool = await getCorePool();
  const { rows } = await pool.query(
    `SELECT id, text, done, list FROM tasks WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({ id: r.id, text: r.text, done: !!r.done, list: r.list }));
}

export async function createTask(userId: string, text: string, list: string): Promise<void> {
  const pool = await getCorePool();
  const id = newRandomId("task");
  await pool.query(
    `INSERT INTO tasks (id, user_id, text, done, list) VALUES ($1,$2,$3,FALSE,$4)`,
    [id, userId, text, list || "Studies"]
  );
}

export async function toggleTask(userId: string, taskId: string): Promise<boolean> {
  const pool = await getCorePool();
  const { rows } = await pool.query(`SELECT id FROM tasks WHERE id=$1 AND user_id=$2`, [taskId, userId]);
  if (!rows[0]) return false;
  await pool.query(`UPDATE tasks SET done = NOT done WHERE id=$1 AND user_id=$2`, [taskId, userId]);
  return true;
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const pool = await getCorePool();
  await pool.query(`DELETE FROM tasks WHERE id=$1 AND user_id=$2`, [taskId, userId]);
}

// --- Calendar events ---
export interface CalendarEventDoc { id: string; date: string; title: string; type: string; }

export async function getCalendarEvents(userId: string): Promise<CalendarEventDoc[]> {
  const pool = await getCorePool();
  const { rows } = await pool.query(
    `SELECT id, date, title, type FROM calendar_events WHERE user_id = $1 ORDER BY date ASC`,
    [userId]
  );
  return rows;
}

export async function createCalendarEvent(userId: string, date: string, title: string, type: string): Promise<CalendarEventDoc> {
  const pool = await getCorePool();
  const id = newRandomId("evt");
  await pool.query(
    `INSERT INTO calendar_events (id, user_id, date, title, type) VALUES ($1,$2,$3,$4,$5)`,
    [id, userId, date, title, type || "Personal"]
  );
  return { id, date, title, type: type || "Personal" };
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  const pool = await getCorePool();
  await pool.query(`DELETE FROM calendar_events WHERE id=$1 AND user_id=$2`, [eventId, userId]);
}

// --- Expenses ---
export interface ExpenseDoc { id: string; description: string; cost: number; category: string; createdAt: string; }

export async function getExpenses(userId: string): Promise<ExpenseDoc[]> {
  const pool = await getCorePool();
  const { rows } = await pool.query(
    `SELECT id, description, cost, category, created_at FROM expenses WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    cost: Number(r.cost),
    category: r.category,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
  }));
}

export async function createExpense(userId: string, description: string, cost: number, category: string): Promise<void> {
  const pool = await getCorePool();
  const id = newRandomId("exp");
  await pool.query(
    `INSERT INTO expenses (id, user_id, description, cost, category) VALUES ($1,$2,$3,$4,$5)`,
    [id, userId, description, cost, category || "General"]
  );
}

export async function deleteExpense(userId: string, expenseId: string): Promise<void> {
  const pool = await getCorePool();
  await pool.query(`DELETE FROM expenses WHERE id=$1 AND user_id=$2`, [expenseId, userId]);
}

// --- Telegram config (per user, used by real broadcast + cron automations) ---
export async function setTelegramConfig(userId: string, token: string, chatId: string): Promise<void> {
  const pool = await getCorePool();
  await pool.query(`UPDATE users SET telegram_bot_token=$1, telegram_chat_id=$2 WHERE id=$3`, [token, chatId, userId]);
}

export async function getTelegramConfig(userId: string): Promise<{ token: string | null; chatId: string | null }> {
  const pool = await getCorePool();
  const { rows } = await pool.query(`SELECT telegram_bot_token, telegram_chat_id FROM users WHERE id=$1`, [userId]);
  if (!rows[0]) return { token: null, chatId: null };
  return { token: rows[0].telegram_bot_token, chatId: rows[0].telegram_chat_id };
}

// Reverse lookup for the incoming Telegram webhook: given the chat.id a
// message arrived from, find which app user configured that chat. A
// webhook has no login/session attached to it — this is how it knows
// whose account (and therefore whose Gemini context/history) an incoming
// message belongs to.
export async function findUserByTelegramChatId(chatId: string): Promise<UserDoc | undefined> {
  const pool = await getCorePool();
  const { rows } = await pool.query(`SELECT * FROM users WHERE telegram_chat_id = $1 LIMIT 1`, [chatId]);
  return rows[0] ? rowToUserDoc(rows[0]) : undefined;
}

// --- Chunked large-file uploads ---
// Vercel serverless functions hard-cap a single incoming request at 4.5MB,
// which is a platform limit no amount of app code can raise. Instead of
// requiring external Blob storage (which needs a manual dashboard
// connection step), we split big files into small pieces on the client and
// send each piece as its own well-under-4.5MB request, storing them
// temporarily in Postgres (already required for users/Telegram) keyed by an
// upload session id, then reassemble and delete them once all pieces
// arrive. Real, needs no new external service or dashboard step.
export async function saveUploadChunk(sessionId: string, chunkIndex: number, dataBase64: string): Promise<void> {
  const pool = await getCorePool();
  await pool.query(
    `INSERT INTO document_upload_chunks (session_id, chunk_index, data_base64) VALUES ($1, $2, $3)
     ON CONFLICT (session_id, chunk_index) DO UPDATE SET data_base64 = EXCLUDED.data_base64`,
    [sessionId, chunkIndex, dataBase64]
  );
}

export async function getUploadChunksOrdered(sessionId: string): Promise<string[]> {
  const pool = await getCorePool();
  const { rows } = await pool.query(
    `SELECT data_base64 FROM document_upload_chunks WHERE session_id = $1 ORDER BY chunk_index ASC`,
    [sessionId]
  );
  return rows.map((r) => r.data_base64);
}

export async function deleteUploadChunks(sessionId: string): Promise<void> {
  const pool = await getCorePool();
  await pool.query(`DELETE FROM document_upload_chunks WHERE session_id = $1`, [sessionId]);
}
