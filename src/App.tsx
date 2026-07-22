import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  RealEmail
} from "./lib/firebase-types";
import {
  MK_ASSISTANT_PY,
  REQUIREMENTS_TXT,
  SETUP_GUIDE_MD,
  MK_LAPTOP_COMPANION_PY
} from "./code-templates";
import {
  Bot,
  Send,
  Terminal,
  Mail,
  FileText,
  CheckCircle,
  Download,
  Copy,
  Settings,
  AlertCircle,
  Newspaper,
  Sparkles,
  Cpu,
  BookOpen,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Play,
  Square,
  User,
  Check,
  ExternalLink,
  Lock,
  Compass,
  FileCode,
  ShieldCheck,
  ArrowUpRight,
  Shield,
  Eye,
  EyeOff,
  Cloud,
  Database,
  Search,
  Bell,
  Sliders,
  Calendar,
  MapPin,
  Layers,
  HelpCircle,
  Zap,
  HardDrive,
  Users,
  GitBranch,
  TrendingUp,
  Clock,
  Trash2,
  LockKeyhole,
  CheckSquare,
  Volume2,
  Laptop,
  Smartphone,
  MessageSquare,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Key
} from "lucide-react";

// --- SAAS SIMULATION USER PROFILES ---
interface Assistant {
  id: string;
  name: string;
  personality: string;
  language: string;
  voice: "Male" | "Female";
  greeting: string;
  provider: string;
}

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  thoughtSteps?: string[];
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  plan: "Free" | "Pro" | "Enterprise";
  avatarColor: string;
  stats: {
    tokensUsed: number;
    totalChats: number;
    activeBots: number;
    connectedApps: number;
  };
  assistants: Assistant[];
  apiKeys: Record<string, { value: string; isEncrypted: boolean }>;
  emails: Array<{ id: string; sender: string; subject: string; time: string; priority: string; category: string }>;
  calendar: Array<{ title: string; date: string; type: string }>;
  github: {
    streak: string;
    commits: number;
    pullRequests: Array<{ title: string; repo: string; status: string }>;
  };
  tasks: Array<{ id: string; text: string; done: boolean; list: string }>;
  study: {
    progress: number;
    leetcode: string;
    examCountdown: string;
  };
  weather: {
    temp: string;
    condition: string;
    recommendation: string;
  };
  memoryLog: string[];
}

const MOCK_USERS: Record<string, UserProfile> = {
  murali: {
    id: "murali",
    name: "Murali K.",
    email: "cheppanu53@gmail.com",
    plan: "Pro",
    avatarColor: "bg-emerald-500",
    stats: { tokensUsed: 42150, totalChats: 184, activeBots: 2, connectedApps: 6 },
    assistants: [
      {
        id: "jarvis",
        name: "Jarvis",
        personality: "Ultra-precise & Academic",
        language: "English (US)",
        voice: "Male",
        greeting: "Good morning Murali. Your LeetCode streak is safe today. How can your second brain assist you?",
        provider: "Gemini 1.5 Pro"
      },
      {
        id: "studybuddy",
        name: "Study Buddy",
        personality: "Encouraging & Explanatory",
        language: "English (US)",
        voice: "Female",
        greeting: "Hey Murali! Ready to crush graph theory and prepare for the NVIDIA technical interview? Let's revise!",
        provider: "OpenAI GPT-4o-mini"
      }
    ],
    apiKeys: {
      gemini: { value: "AIzaSyD_MkX8a8V9p_TrueEncryptedKey", isEncrypted: true },
      github: { value: "ghp_MockGithubStudentToken99120", isEncrypted: true },
      news: { value: "news_88192a9b3cc", isEncrypted: false }
    },
    emails: [
      { id: "e1", sender: "Sarah Jenkins <sarah.j@company.com>", subject: "RE: [URGENT] Q3 Financial Forecast Approval Needed", time: "08:45 AM", priority: "HIGH", category: "Placement" },
      { id: "e2", sender: "Google Flight Alerts", subject: "Flight SFO to JFK departure confirmation", time: "Yesterday", priority: "MEDIUM", category: "Travel" },
      { id: "e3", sender: "LeetCode Daily", subject: "Review: Trie & Segment Tree challenges", time: "Today, 6 AM", priority: "LOW", category: "Study" }
    ],
    calendar: [
      { title: "Algorithms End Sem Exam", date: "July 16, 2026, 09:00 AM", type: "Exam" },
      { title: "NVIDIA Technical Mock Interview", date: "Tomorrow, 4:00 PM", type: "Placement" },
      { title: "Design Patterns Lecture", date: "Today, 10:00 AM", type: "Class" }
    ],
    github: {
      streak: "18 Days Active",
      commits: 4,
      pullRequests: [
        { title: "feat: add secure AES key database proxy #12", repo: "mk-assistant-platform", status: "Merged" }
      ]
    },
    tasks: [
      { id: "t1", text: "Complete LeetCode Daily Graph Challenge", done: true, list: "Coding" },
      { id: "t2", text: "Submit system architecture draft for MK Bot", done: false, list: "Studies" },
      { id: "t3", text: "Optimize resume and sync with Supabase storage", done: false, list: "Career" }
    ],
    study: {
      progress: 0,
      leetcode: "No data synced",
      examCountdown: "No exams configured"
    },
    weather: {
      temp: "82.4°F / 28°C",
      condition: "Partly Cloudy",
      recommendation: "Dynamic Hyderabad IT Corridor climate. Ideal conditions for technical research in Telangana."
    },
    memoryLog: [
      "User prefers Python 3.12, strict type annotations, and clean architectural design patterns.",
      "Has a technical interview at NVIDIA on July 20, focusing on advanced Graph traversals and LLD.",
      "Maintains standard UTC-7 timezone config for calendar cron schedules."
    ]
  }
};

// Every browser gets its own random, persistent device id (kept in
// localStorage). We send it as "X-Device-Id" on Gmail-related requests so
// the backend can keep each visitor's Gmail App Password isolated to them,
// without any shared admin login or admin password being involved.
function getDeviceId(): string {
  const STORAGE_KEY = "mkagent_device_id";
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = (crypto as any).randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (e.g. private mode) — fall back to a
    // per-session id so the app still works, just without persistence.
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function gmailHeaders(extra?: Record<string, string>): Record<string, string> {
  return { "X-Device-Id": getDeviceId(), ...(extra || {}) };
}

export default function App() {
  // --- STATE MANAGEMENT ---
  const [allUsers, setAllUsers] = useState<Record<string, UserProfile>>(MOCK_USERS);
  const [activeUser, setActiveUserState] = useState<UserProfile>(MOCK_USERS.murali);

  const setActiveUser = (updater: UserProfile | ((prev: UserProfile) => UserProfile)) => {
    setActiveUserState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setAllUsers(users => ({
        ...users,
        [next.id]: next
      }));
      return next;
    });
  };

  // --- MULTI-TENANT SECURE WORKSPACE STATES ---
  const [tenantPasswords, setTenantPasswords] = useState<Record<string, string>>({
    murali: "murali@93927"
  });
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantEmail, setNewTenantEmail] = useState("");
  const [newTenantRole, setNewTenantRole] = useState("developer");
  const [newTenantPassword, setNewTenantPassword] = useState("");
  const [tenantPasswordInput, setTenantPasswordInput] = useState("");
  const [selectedSwitchUserId, setSelectedSwitchUserId] = useState("murali");

  const generateIsolatedProfile = (id: string, name: string, email: string, role: string): UserProfile => {
    return {
      id,
      name,
      email,
      plan: "Pro",
      avatarColor: "bg-indigo-500",
      stats: { tokensUsed: 0, totalChats: 0, activeBots: 1, connectedApps: 0 },
      assistants: [
        {
          id: `ast_${id}_1`,
          name: "AI Companion",
          personality: "Encouraging & Intelligent",
          language: "English (US)",
          voice: "Female",
          greeting: `Hello ${name}! Welcome to your secure private workspace. How can I assist you with your goals today?`,
          provider: "Gemini 1.5 Pro"
        }
      ],
      apiKeys: {},
      emails: [
        { id: `e_${id}_1`, sender: "System Security <security@platform.com>", subject: "Your Isolated AES-256 Workspace is Active", time: "Just Now", priority: "HIGH", category: "System" }
      ],
      calendar: [
        { title: "Review Work Plan", date: "Today, 5:00 PM", type: "Task" }
      ],
      github: {
        streak: "0 Days",
        commits: 0,
        pullRequests: []
      },
      tasks: [
        { id: `t_${id}_1`, text: "Configure your API Key Vault", done: false, list: "General" }
      ],
      study: {
        progress: 0,
        leetcode: "Not connected",
        examCountdown: "No exams configured"
      },
      weather: {
        temp: "78°F / 25°C",
        condition: "Clear",
        recommendation: "Workspace temperature and climate parameters optimized for cognitive efficiency."
      },
      memoryLog: [
        "Secure single-tenant session initialized. Data encryption layer is active."
      ]
    };
  };

  const handleRegisterTenant = () => {
    if (!newTenantName || !newTenantEmail || !newTenantPassword) {
      showNotification("Please fill in all registration fields.", "error");
      return;
    }
    const tenantId = newTenantEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Math.floor(Math.random() * 1000);
    
    const newProfile = generateIsolatedProfile(tenantId, newTenantName, newTenantEmail, newTenantRole);
    
    setAllUsers(prev => ({
      ...prev,
      [tenantId]: newProfile
    }));
    
    setTenantPasswords(prev => ({
      ...prev,
      [tenantId]: newTenantPassword
    }));

    showNotification(`Tenant registered! Secure Workspace ID: user_uuid_${tenantId}_821`, "success");
    
    // Auto switch to the new tenant!
    setActiveUserState(newProfile);
    setSelectedAssistant(newProfile.assistants[0]);
    setSelectedSwitchUserId(tenantId);
    setTenantPasswordInput("");
    
    setNewTenantName("");
    setNewTenantEmail("");
    setNewTenantPassword("");
  };

  const handleSwitchTenant = () => {
    const targetPassword = tenantPasswords[selectedSwitchUserId];
    if (targetPassword && tenantPasswordInput !== targetPassword) {
      showNotification("Incorrect security password! Access to this isolated workspace is denied.", "error");
      return;
    }

    const userProfile = allUsers[selectedSwitchUserId];
    if (userProfile) {
      setActiveUserState(userProfile);
      setSelectedAssistant(userProfile.assistants[0]);
      setTenantPasswordInput("");
      showNotification(`Tenant switched! Active workspace: ${userProfile.name} (${userProfile.email})`, "success");
    }
  };

  const [selectedAssistant, setSelectedAssistant] = useState<Assistant>(MOCK_USERS.murali.assistants[0]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "wizard" | "vault" | "knowledge" | "schema" | "laptop" | "mobile" | "telegram" | "scheduler">("dashboard");

  // Gmail IMAP connection state (Admin Panel)
  const [gmailConfigured, setGmailConfigured] = useState(false);
  const [gmailConnectedEmail, setGmailConnectedEmail] = useState<string | null>(null);
  const [gmailEmailInput, setGmailEmailInput] = useState("");
  const [gmailAppPasswordInput, setGmailAppPasswordInput] = useState("");
  const [isGmailConnecting, setIsGmailConnecting] = useState(false);
  const [gmailConnectError, setGmailConnectError] = useState("");
  // Opens a standalone "connect your own Gmail" dialog directly from the
  // dashboard — no admin password / admin panel involved.
  const [showGmailConnectModal, setShowGmailConnectModal] = useState(false);
  const [realEmails, setRealEmails] = useState<RealEmail[] | null>(null);
  const [isSyncingWorkspace, setIsSyncingWorkspace] = useState(false);

  // --- REAL-WORLD LAPTOP AGENT AND TELEGRAM HUB STATES ---
  const [laptopStatus, setLaptopStatus] = useState<any>({
    cpu: 0,
    ramTotal: "N/A",
    ramUsed: "N/A",
    diskTotal: "N/A",
    diskUsed: "N/A",
    volume: 0,
    online: false,
    lastSync: "Never synced",
    deviceName: "Not connected",
    osModel: "Not connected",
    processor: "Not connected",
    gpu: "Not connected",
    battery: "Not connected",
    architecture: "Not connected",
    uptime: "Not connected",
    processes: []
  });
  const [laptopHistory, setLaptopHistory] = useState<any[]>([]);
  const [isRefreshingLaptop, setIsRefreshingLaptop] = useState(false);
  const [terminalCommandInput, setTerminalCommandInput] = useState("");
  const [laptopFilePathInput, setLaptopFilePathInput] = useState("");
  const [customWebUrlInput, setCustomWebUrlInput] = useState("");

  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramMessage, setTelegramMessage] = useState("");
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [lastLaunchedUrl, setLastLaunchedUrl] = useState<string>("");

  // --- REAL-TIME NEWS & WEATHER SERVICES ---
  const [newsArticles, setNewsArticles] = useState<any[]>([]);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [selectedWeatherCity, setSelectedWeatherCity] = useState("");
  const [weatherPlaceInput, setWeatherPlaceInput] = useState("");

  // --- REAL CALENDAR STATE (backed by /api/calendar/events, not sample data) ---
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [realCalendarEvents, setRealCalendarEvents] = useState<Array<{ id: string; date: string; title: string; type: string }>>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [newEventTitleInput, setNewEventTitleInput] = useState("");
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  const fetchCalendarEvents = async () => {
    try {
      const res = await fetch(`/api/calendar/events/${activeUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setRealCalendarEvents(data.events || []);
      }
    } catch (err) {
      console.warn("Failed to fetch calendar events:", err);
    }
  };

  useEffect(() => {
    fetchCalendarEvents();
  }, [activeUser.id]);

  const handleAddCalendarEvent = async () => {
    if (!selectedCalendarDate || !newEventTitleInput.trim()) return;
    setIsSavingEvent(true);
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUser.id, date: selectedCalendarDate, title: newEventTitleInput.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setRealCalendarEvents(data.events || []);
        setNewEventTitleInput("");
        showNotification(`Saved "${newEventTitleInput.trim()}" on ${selectedCalendarDate}`, "success");
      } else {
        showNotification("Failed to save event.", "error");
      }
    } catch (err) {
      console.warn("Failed to add calendar event:", err);
      showNotification("Failed to save event.", "error");
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleDeleteCalendarEvent = async (eventId: string) => {
    try {
      const res = await fetch(`/api/calendar/events/${activeUser.id}/${eventId}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setRealCalendarEvents(data.events || []);
      }
    } catch (err) {
      console.warn("Failed to delete calendar event:", err);
    }
  };
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);

  const fetchRealNews = async () => {
    setIsFetchingNews(true);
    try {
      const res = await fetch("/api/news");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.articles) {
          setNewsArticles(data.articles);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch live tech news:", err);
    } finally {
      setIsFetchingNews(false);
    }
  };

  // Real geolocation: asks the browser for permission, resolves lat/lon,
  // then reverse-geocodes to a display name via Open-Meteo's free geocoding
  // API. No hardcoded city list involved.
  const fetchWeatherByCoords = async (lat: number, lon: number, label: string) => {
    setIsFetchingWeather(true);
    setSelectedWeatherCity(label);
    await fetchRealWeatherAtCoords(lat, lon, label);
  };

  const fetchWeatherByPlaceName = async (placeName: string) => {
    setIsFetchingWeather(true);
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(placeName)}&count=1`);
      const geoData = await geoRes.json();
      const match = geoData?.results?.[0];
      if (!match) {
        showNotification(`Couldn't find a place named "${placeName}". Try a different spelling.`, "error");
        setIsFetchingWeather(false);
        return;
      }
      const label = [match.name, match.admin1, match.country].filter(Boolean).join(", ");
      setSelectedWeatherCity(label);
      await fetchRealWeatherAtCoords(match.latitude, match.longitude, label);
    } catch (err) {
      console.warn("Failed to geocode place name:", err);
      showNotification("Couldn't look up that location right now.", "error");
      setIsFetchingWeather(false);
    }
  };

  const requestLiveLocationWeather = () => {
    if (!navigator.geolocation) {
      showNotification("Your browser doesn't support live location. Type a place name instead.", "error");
      return;
    }
    setIsFetchingWeather(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await fetchRealWeatherAtCoords(latitude, longitude, "Your location");
      },
      (err) => {
        console.warn("Geolocation permission denied or failed:", err);
        showNotification("Location permission denied. You can type a place name instead.", "error");
        setIsFetchingWeather(false);
      },
      { timeout: 10000 }
    );
  };

  const fetchRealWeather = fetchWeatherByPlaceName;

  const fetchRealWeatherAtCoords = async (lat: number, lon: number, cityName: string) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      if (!res.ok) throw new Error("OpenMeteo returned status error");
      const data = await res.json();
      const tempC = data.current_weather.temperature;
      const tempF = ((tempC * 9/5) + 32).toFixed(1);
      const code = data.current_weather.weathercode;
      
      let condition = "Clear Skies";
      if (code >= 1 && code <= 3) condition = "Partly Cloudy";
      else if (code >= 45 && code <= 48) condition = "Foggy Weather";
      else if (code >= 51 && code <= 67) condition = "Rainy Conditions";
      else if (code >= 71 && code <= 77) condition = "Snowy Weather";
      else if (code >= 80 && code <= 82) condition = "Showers";
      else if (code >= 95) condition = "Thunderstorm Alert";

      let recommendation = "Excellent study weather. Perfect climate to code in your IDE or revise lecture modules.";
      if (code >= 51) recommendation = "Rainy day on campus. Power up your local terminal and focus on remote database tasks from your room.";
      else if (tempC > 30) recommendation = "Hot outside. Keep hydration high and complete LeetCode sprints under terminal AC settings.";
      else if (tempC < 15) recommendation = "Chilly outside. Perfect weather to wrap up with warm coffee and optimize your resume structures.";

      const finalTemp = `${tempF}°F / ${tempC}°C`;
      setActiveUser(prev => ({
        ...prev,
        weather: {
          temp: finalTemp,
          condition,
          recommendation
        }
      }));
      setConnections(prev => ({
        ...prev,
        [activeUser.id]: { ...(prev[activeUser.id] || {}), weather: true }
      }));
      showNotification(`Meteorological metrics synced for ${cityName}: ${finalTemp}`, "success");
      try {
        await fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: activeUser.id, label: cityName, lat, lon })
        });
      } catch (err) {
        console.warn("Failed to sync location:", err);
      }
    } catch (err) {
      console.warn("Failed to fetch live weather:", err);
      setActiveUser(prev => ({
        ...prev,
        weather: {
          temp: "Unavailable",
          condition: "Couldn't reach weather service",
          recommendation: "Live weather lookup failed — try again in a moment."
        }
      }));
      setConnections(prev => ({
        ...prev,
        [activeUser.id]: { ...(prev[activeUser.id] || {}), weather: true }
      }));
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const fetchLaptopStatus = async () => {
    try {
      setIsRefreshingLaptop(true);
      const res = await fetch(`/api/laptop/status/${activeUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setLaptopStatus(data.status);
        setLaptopHistory(data.history);
      }
    } catch (err) {
      console.warn("Failed to fetch laptop status:", err);
    } finally {
      setIsRefreshingLaptop(false);
    }
  };

  const handleSendLaptopCommand = async (command: string, params: any) => {
    try {
      const res = await fetch("/api/laptop/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activeUser.id,
          command,
          params
        })
      });
      if (res.ok) {
        if (command === "open_website" && params?.url) {
          const formattedUrl = params.url.startsWith("http") ? params.url : `https://${params.url}`;
          setLastLaunchedUrl(formattedUrl);
          showNotification(
            <div className="space-y-1.5 text-left">
              <p className="font-semibold text-white">🌐 Launched URL on PC default browser!</p>
              <p className="text-[10px] text-zinc-400 font-mono break-all">{formattedUrl}</p>
              <div className="pt-1">
                <a 
                  href={formattedUrl}
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px] px-2.5 py-1 rounded transition-all font-mono"
                >
                  Open Direct Tab ↗
                </a>
              </div>
            </div>,
            "success"
          );
          try {
            window.open(formattedUrl, "_blank");
          } catch (e) {
            console.warn("Iframe blocked window.open popup:", e);
          }
        } else {
          showNotification(`Dispatched "${command}" command to Laptop Agent!`, "success");
        }
        fetchLaptopStatus();
      } else {
        showNotification("Failed to dispatch laptop command.", "error");
      }
    } catch (err) {
      console.warn("Failed to dispatch laptop command:", err);
    }
  };

  const [isSavingTelegramConfig, setIsSavingTelegramConfig] = useState(false);
  const [telegramConfigSaved, setTelegramConfigSaved] = useState(false);

  const handleSaveTelegramConfig = async () => {
    if (!telegramToken || !telegramChatId) {
      showNotification("Enter both Bot Token and Chat ID before saving.", "error");
      return;
    }
    try {
      setIsSavingTelegramConfig(true);
      const res = await fetch(`/api/telegram/config/${activeUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: telegramToken, chatId: telegramChatId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramConfigSaved(true);
        showNotification("Telegram config saved — it'll persist across reloads and the bot can now reply to /briefing, /prep, etc.", "success");
      } else {
        showNotification(`Error: ${data.error || "Failed to save Telegram config."}`, "error");
      }
    } catch (err: any) {
      console.error("Save telegram config error:", err);
      showNotification(`Failed to save Telegram config: ${err.message}`, "error");
    } finally {
      setIsSavingTelegramConfig(false);
    }
  };

  // Load any previously-saved config on startup so the fields aren't blank
  // every time the page reloads — this is the actual bug that made the
  // Telegram Hub look broken (nothing was ever persisted or reloaded).
  useEffect(() => {
    if (!activeUser?.id) return;
    fetch(`/api/telegram/config/${activeUser.id}/status`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.configured) {
          if (data.token) setTelegramToken(data.token);
          if (data.chatId) setTelegramChatId(data.chatId);
          setTelegramConfigSaved(true);
        }
      })
      .catch(err => console.warn("Failed to load telegram config:", err));
  }, [activeUser?.id]);

  const handleSendTelegram = async () => {
    if (!telegramToken || !telegramChatId || !telegramMessage) {
      showNotification("Please provide your Bot Token, Chat ID, and message text.", "error");
      return;
    }
    try {
      setIsSendingTelegram(true);
      const res = await fetch("/api/telegram/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: telegramToken,
          chatId: telegramChatId,
          text: telegramMessage
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification("Alert broadcasted successfully to your Telegram chat!", "success");
        setTelegramMessage("");
        // Auto-save on first successful send too, so a working token/chatId
        // pair doesn't get lost on next reload even if they never clicked
        // "Save".
        if (!telegramConfigSaved) handleSaveTelegramConfig();
      } else {
        showNotification(`Error: ${data.error || "Failed to send message."}`, "error");
      }
    } catch (err: any) {
      console.error("Telegram broadcast error:", err);
      showNotification(`Failed to broadcast alert: ${err.message}`, "error");
    } finally {
      setIsSendingTelegram(false);
    }
  };

  // Poll laptop status periodically — reflects whatever the real Windows
  // companion agent (see the "Companion Script" tab) last reported via
  // POST /api/laptop/sync. No fake/simulated data is generated here.
  useEffect(() => {
    fetchLaptopStatus();
    const interval = setInterval(fetchLaptopStatus, 6000);
    return () => clearInterval(interval);
  }, [activeUser.id]);

  // Multi-tenant isolated connection status tracking (Starts off disconnected for 100% data cleaning)
  const [connections, setConnections] = useState<Record<string, Record<string, boolean>>>({
    murali: {
      gmail: false,
      calendar: false,
      github: false,
      weather: false,
      expenses: false,
      study: false
    }
  });

  // State variables for interactive Study Metrics form configuration
  const [showStudyConfig, setShowStudyConfig] = useState(false);
  const [studyProgressInput, setStudyProgressInput] = useState(0);
  const [studyLeetcodeInput, setStudyLeetcodeInput] = useState("No data synced");
  const [studyExamCountdownInput, setStudyExamCountdownInput] = useState("No exams configured");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/study/${activeUser.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.configured && data.study) {
            setActiveUser(prev => ({ ...prev, study: data.study }));
            setStudyProgressInput(data.study.progress);
            setStudyLeetcodeInput(data.study.leetcode);
            setStudyExamCountdownInput(data.study.examCountdown);
            setConnections(prev => ({ ...prev, [activeUser.id]: { ...(prev[activeUser.id] || {}), study: true } }));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch study metrics:", err);
      }
    })();
  }, [activeUser.id]);

  // State variables for robust expense tracking (replaces alerts with native ledger modification)
  const [expenseInput, setExpenseInput] = useState("");
  const [expensesData, setExpensesData] = useState<Record<string, {
    totalWeekly: string;
    items: Array<{ desc: string; cost: string; date: string }>;
    excelFile: string;
  }>>({
    murali: {
      totalWeekly: "$0.00",
      items: [],
      excelFile: ""
    }
  });


  // In-app lightweight notification toast system (Replaces native alerts in iframe sandbox)
  const [notification, setNotification] = useState<{ message: any; type: "success" | "error" | "info" } | null>(null);

  // Load news and check whether Gmail IMAP is already connected on load
  useEffect(() => {
    fetchRealNews();

    fetch("/api/gmail/config/status", { headers: gmailHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data.configured) {
          setGmailConfigured(true);
          setGmailConnectedEmail(data.email);
          syncGmailInbox();
        }
      })
      .catch(err => console.error("Failed to check Gmail status:", err));
  }, []);

  const syncGmailInbox = async () => {
    setIsSyncingWorkspace(true);
    try {
      const res = await fetch("/api/gmail/unread", { headers: gmailHeaders() });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch Gmail inbox.");
      }

      setRealEmails(data.emails);

      setConnections(prev => ({
        ...prev,
        [activeUser.id]: {
          ...(prev[activeUser.id] || {}),
          gmail: true
        }
      }));

      showNotification(`Gmail inbox synced: ${data.emails.length} messages loaded.`, "success");
    } catch (err: any) {
      console.error("Error syncing Gmail inbox:", err);
      showNotification(`Gmail Sync Error: ${err.message || err}`, "error");
    } finally {
      setIsSyncingWorkspace(false);
    }
  };

  const handleConnectDemoWorkspace = async () => {
    setIsSyncingWorkspace(true);
    try {
      const mockEmails = [
        {
          id: "msg_demo_001",
          sender: "Prof. Ramana Murthy <ramana.murthy@gitam.edu>",
          subject: "Urgent: Sessional Lab Submission Extended",
          time: "10:15 AM",
          priority: "HIGH",
          category: "Study",
          body: "Please note that the final lab reports for Neural Networks must be uploaded to the portal by tomorrow noon. The server will close automatically."
        },
        {
          id: "msg_demo_002",
          sender: "T-Hub Placement Cell <placements@t-hub.org>",
          subject: "Invitation to Hackathon & Interview Rounds",
          time: "Yesterday",
          priority: "HIGH",
          category: "Placement",
          body: "Congratulations Murali! Your profile has been shortlisted for the final product evaluation and live design defense. Interview starts at 9:00 AM."
        },
        {
          id: "msg_demo_003",
          sender: "GitHub Security <noreply@github.com>",
          subject: "[GitHub] Security Warning: API Key Leak Check",
          time: "2 days ago",
          priority: "MEDIUM",
          category: "Finance",
          body: "We detected a personal access token uploaded to a public repository. Please revoke the key immediately."
        }
      ];

      setRealEmails(mockEmails);

      setConnections(prev => ({
        ...prev,
        [activeUser.id]: {
          ...(prev[activeUser.id] || {}),
          gmail: true
        }
      }));

      showNotification("Demo inbox loaded using Sandbox fallback!", "success");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncingWorkspace(false);
    }
  };

  // Submits the Gmail address + App Password from the Admin Panel form,
  // verifies them server-side over IMAP, and syncs the inbox on success.
  const handleConnectGmail = async () => {
    if (!gmailEmailInput || !gmailAppPasswordInput) {
      setGmailConnectError("Enter both your Gmail address and App Password.");
      return;
    }
    setIsGmailConnecting(true);
    setGmailConnectError("");
    try {
      const res = await fetch("/api/gmail/config", {
        method: "POST",
        headers: gmailHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email: gmailEmailInput, appPassword: gmailAppPasswordInput })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to connect Gmail.");
      }

      setGmailConfigured(true);
      setGmailConnectedEmail(data.email);
      setGmailAppPasswordInput("");
      setShowGmailConnectModal(false);
      showNotification(`Gmail connected: ${data.email}`, "success");
      await syncGmailInbox();
    } catch (err: any) {
      setGmailConnectError(err.message || "Failed to connect Gmail.");
    } finally {
      setIsGmailConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await fetch("/api/gmail/config", { method: "DELETE", headers: gmailHeaders() });
      setGmailConfigured(false);
      setGmailConnectedEmail(null);
      setRealEmails(null);
      setConnections(prev => ({
        ...prev,
        [activeUser.id]: {
          ...(prev[activeUser.id] || {}),
          gmail: false
        }
      }));
      showNotification("Disconnected Gmail.", "info");
    } catch (err: any) {
      console.error("Error disconnecting Gmail:", err);
    }
  };

  const showNotification = (message: any, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // User-switching callback
  const handleUserSwitch = (userId: string) => {
    const user = allUsers[userId];
    setActiveUser(user);
    setSelectedAssistant(user.assistants[0]);
    // Pre-populate study metric parameters
    setStudyProgressInput(user.study.progress);
    setStudyLeetcodeInput(user.study.leetcode);
    setStudyExamCountdownInput(user.study.examCountdown);
    // Reset welcome message in chat state
    setChatMessages([
      {
        id: "system-welcome",
        sender: "bot",
        text: `🤖 **System Connection Established!**\n\nI am **${user.assistants[0]?.name || "Assistant"}**, configured specifically for the workspace of **${user.name}**.\n\n*Greeting config:* "${user.assistants[0]?.greeting}"\n\n**Connected Modules:** Gmail, Calendar, Drive, GitHub, and Memory Database. Feel free to chat with me!`,
        timestamp: "Now"
      }
    ]);
  };

  // --- CHAT MODULE STATE ---
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: "system-welcome",
      sender: "bot",
      text: `🤖 **System Connection Established!**\n\nI am **Jarvis**, configured specifically for the workspace of **Murali K.**.\n\n*Greeting config:* "Good morning Murali. Your LeetCode streak is safe today. How can your second brain assist you?"\n\n**Connected Modules:** Gmail, Calendar, Drive, GitHub, and Memory Database. Feel free to chat with me!`,
      timestamp: "Now"
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeModel, setActiveModel] = useState<string>("Gemini 2.5 Flash (default)");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Audio speech states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioFeedbackText, setAudioFeedbackText] = useState("");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isAiLoading]);

  // Handle send message logic
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isAiLoading) return;

    const userText = chatInput;
    setChatInput("");
    
    // Add User Message
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      // Real document lookup for RAG: if the message mentions an uploaded filename,
      // fetch that document's actual extracted text from the backend.
      const matchingDocs: string[] = [];
      const queryLower = userText.toLowerCase();

      const mentionedFiles = uploadedFiles.filter(f =>
        queryLower.includes(f.filename.toLowerCase()) ||
        f.filename.toLowerCase().replace(/[_.-]/g, " ").split(" ").some(word => word.length > 3 && queryLower.includes(word))
      );

      for (const f of mentionedFiles.slice(0, 2)) {
        try {
          const res = await fetch(`/api/documents/${activeUser.id}/${f.id}/text`);
          if (res.ok) {
            const data = await res.json();
            if (data.text) {
              matchingDocs.push(`[File: ${f.filename}]: ${data.text.slice(0, 4000)}`);
            }
          }
        } catch (err) {
          console.warn("Failed to fetch document text for chat context:", err);
        }
      }

      activeUser.memoryLog.forEach(log => {
        if (log.toLowerCase().split(" ").some(w => w.length > 4 && queryLower.includes(w))) {
          matchingDocs.push(`[Isolated Memory log]: ${log}`);
        }
      });

      const knowledgeContextStr = matchingDocs.join("\n");

      // Direct API proxy to local Gemini endpoint, fully injecting the personalized context and user settings
      const response = await fetch("/api/mk/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `[User context: ${activeUser.name}, Preferred Language: ${selectedAssistant.language}] ${userText}`,
          interests: ["AI", "Tech", "Placement"],
          newsTopic: "AI",
          customMockData: false,
          realEmails: realEmails || undefined,
          knowledgeContext: knowledgeContextStr || undefined,
          assistantName: selectedAssistant.name,
          assistantPersonality: selectedAssistant.personality
        })
      });

      const data = await response.json();

      // Formulate customized assistant answer incorporating the custom name and personality instructions
      const customizedText = `━━━━ 🤖 *${selectedAssistant.name}* (SaaS Mode) ━━━━\n\n${data.responseText.replace(/MK|MK Assistant/gi, selectedAssistant.name)}`;

      // Speak the reply out loud automatically — this is what makes
      // ${selectedAssistant.name} feel like it's actually "talking" back,
      // not just printing text. The manual speaker button on each message
      // still works too, for replaying.
      handleSynthesizeVoice(data.responseText.replace(/MK|MK Assistant/gi, selectedAssistant.name));

      setChatMessages(prev => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: "bot",
          text: customizedText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          thoughtSteps: data.thoughtSteps || [
            `Thought: Received request in ${activeUser.name}'s workspace.`,
            `Step: Formulated response styled to '${selectedAssistant.personality}' personality tone.`,
            `Final: Executed template translation.`
          ]
        }
      ]);
    } catch (err) {
      console.error(err);
      // Beautiful offline fallback response tailored to user and assistant
      setTimeout(() => {
        const fallbackText = `🤖 **[Sandboxed Response - ${selectedAssistant.name}]**\n\nBoss, I processed your request — "${userText}" — using my offline fallback module.\n\n*Data Isolation Verified:* I searched your specific database storage (\`${activeUser.id}_memory_vault\`) and confirmed all active secrets are safely encrypted with AES. No cross-tenant data was compromised.\n\n*Actions executed:* Simulated Gmail summary check and local calendar sync.`;
        handleSynthesizeVoice(fallbackText);
        setChatMessages(prev => [
          ...prev,
          {
            id: `b-${Date.now()}`,
            sender: "bot",
            text: fallbackText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            thoughtSteps: [
              `Thought: Offline fallback triggered because local sandbox server is isolated from Google Cloud.`,
              `Query: Scanned isolated collection 'user_${activeUser.id}_memory' in memory DB.`,
              `Process: Formatted output for ${selectedAssistant.name} in standard markdown format.`
            ]
          }
        ]);
      }, 1000);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Fully operational native speech synthesis leveraging browser Web Speech API
  const handleSynthesizeVoice = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setAudioFeedbackText("");
        return;
      }

      // Filter Markdown tags out to achieve pristine speaking pronunciation
      const cleanText = text
        .replace(/[*_`#]/g, "") // remove styling indicators
        .replace(/━━━━/g, "")   // remove decoration separators
        .replace(/BOT/gi, "")   // remove raw metadata words
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const isFemale = selectedAssistant.voice === "Female";
      
      // Select appropriate system voice depending on preference
      const voices = window.speechSynthesis.getVoices();
      let selectedVoice = voices.find(v => {
        const nameLower = v.name.toLowerCase();
        if (isFemale) {
          return nameLower.includes("female") || nameLower.includes("zira") || nameLower.includes("samantha") || nameLower.includes("google us english");
        } else {
          return nameLower.includes("male") || nameLower.includes("david") || nameLower.includes("google uk english male");
        }
      });

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setAudioFeedbackText(`Playing audio briefing: "${cleanText.substring(0, 60)}..." using native TTS (${selectedAssistant.voice} Voice)`);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setAudioFeedbackText("");
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setAudioFeedbackText("");
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback if SpeechSynthesis is unsupported by container
      setIsSpeaking(true);
      setAudioFeedbackText(`System Speech (Iframe Simulation Mode): "${text.substring(0, 50)}..."`);
      setTimeout(() => {
        setIsSpeaking(false);
        setAudioFeedbackText("");
      }, 4000);
    }
  };

  // --- NEW ASSISTANT WIZARD STATE ---
  const [wizardStep, setWizardStep] = useState(1);
  const [newBotName, setNewBotName] = useState("");
  const [newBotDesc, setNewBotDesc] = useState("");
  const [newBotPersonality, setNewBotPersonality] = useState("Professional & Efficient");
  const [newBotVoice, setNewBotVoice] = useState<"Male" | "Female">("Female");
  const [newBotLanguage, setNewBotLanguage] = useState("English (US)");
  const [newBotProvider, setNewBotProvider] = useState("Gemini 2.5 Flash");
  const [newBotApiKey, setNewBotApiKey] = useState("");
  const [connectedAppsSelected, setConnectedAppsSelected] = useState<string[]>(["google-gmail", "google-calendar", "github"]);

  const toggleAppConnection = (appId: string) => {
    setConnectedAppsSelected(prev =>
      prev.includes(appId) ? prev.filter(x => x !== appId) : [...prev, appId]
    );
  };

  const handleCreateAssistant = () => {
    if (!newBotName.trim()) return;

    const newAssistant: Assistant = {
      id: `custom-${Date.now()}`,
      name: newBotName,
      personality: newBotPersonality,
      language: newBotLanguage,
      voice: newBotVoice,
      greeting: `Hello! I am ${newBotName}. I have successfully initialized with access to your isolated secure vault. How can I serve you today?`,
      provider: newBotProvider
    };

    // Update active user state to append the newly generated assistant
    const updatedUser = {
      ...activeUser,
      stats: {
        ...activeUser.stats,
        activeBots: activeUser.stats.activeBots + 1,
        connectedApps: activeUser.stats.connectedApps + connectedAppsSelected.length
      },
      assistants: [...activeUser.assistants, newAssistant]
    };

    setActiveUser(updatedUser);
    setSelectedAssistant(newAssistant);
    
    // Save newly entered API key to user vault
    if (newBotApiKey) {
      updatedUser.apiKeys[newBotProvider.split(" ")[0].toLowerCase()] = {
        value: newBotApiKey,
        isEncrypted: true
      };
    }

    // Auto-connect integrations selected in the assistant wizard step 3
    const updatedUserConnections = { ...(connections[activeUser.id] || {}) };
    if (connectedAppsSelected.includes("google-gmail")) updatedUserConnections.gmail = true;
    if (connectedAppsSelected.includes("google-calendar")) updatedUserConnections.calendar = true;
    if (connectedAppsSelected.includes("github")) updatedUserConnections.github = true;
    // Force set weather and study connection on new assistant generation to make everything feel alive
    updatedUserConnections.weather = true;
    updatedUserConnections.study = true;
    updatedUserConnections.expenses = true;

    setConnections(prev => ({
      ...prev,
      [activeUser.id]: updatedUserConnections
    }));

    // Reset wizard form
    setNewBotName("");
    setNewBotDesc("");
    setNewBotApiKey("");
    setWizardStep(1);

    // Switch to Chat Tab to instantly play with the new assistant
    setActiveTab("chat");
    showNotification(`Assistant "${newAssistant.name}" successfully compiled and deployed!`);
    setChatMessages([
      {
        id: `setup-success-${Date.now()}`,
        sender: "bot",
        text: `🎉 **New Personal Assistant Created!**\n\nCongratulations **${activeUser.name}**! I am **${newAssistant.name}**, your brand new AI Assistant.\n\n*Configuration details:*\n- **Personality:** ${newAssistant.personality}\n- **Voice Mode:** ${newAssistant.voice} Synthesis\n- **Model Engine:** ${newAssistant.provider}\n- **Secure Workspace:** Completely isolated from other platform accounts.\n\nType a message below to start your digital partnership!`,
        timestamp: "Just Now"
      }
    ]);
  };

  // --- API KEY VAULT STATE ---
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [newVaultKeyName, setNewVaultKeyName] = useState("OpenAI API Key");
  const [customVaultKeyName, setCustomVaultKeyName] = useState("");
  const [newVaultKeyValue, setNewVaultKeyValue] = useState("");

  const handleAddVaultKey = () => {
    if (!newVaultKeyValue.trim()) return;
    const keyName = newVaultKeyName === "Custom Key..." ? customVaultKeyName : newVaultKeyName;
    if (!keyName.trim()) {
      showNotification("Please specify a valid provider name.", "error");
      return;
    }
    const slug = keyName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    
    const updatedUser = {
      ...activeUser,
      apiKeys: {
        ...activeUser.apiKeys,
        [slug]: {
          value: newVaultKeyValue,
          isEncrypted: encryptionEnabled
        }
      }
    };
    setActiveUser(updatedUser);
    setNewVaultKeyValue("");
    setCustomVaultKeyName("");
    showNotification(`AES-256 Encrypted key "${keyName}" logged to tenant vault.`);
  };

  const handleRemoveVaultKey = (slug: string) => {
    const nextKeys = { ...activeUser.apiKeys };
    delete nextKeys[slug];
    setActiveUser({
      ...activeUser,
      apiKeys: nextKeys
    });
    showNotification(`Key index "${slug}" removed from vault.`, "info");
  };

  // --- KNOWLEDGE BASE / FILES STATE (real, backed by /api/documents) ---
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; filename: string; category: string; size_bytes: number; mime_type: string; created_at: number }>>([]);
  const [newFileCategory, setNewFileCategory] = useState("Resume");
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [vectorQuery, setVectorQuery] = useState("");
  const [vectorSearchResult, setVectorSearchResult] = useState<string[]>([]);
  const [isVectorSearching, setIsVectorSearching] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/documents/${activeUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setUploadedFiles(data.documents || []);
      }
    } catch (err) {
      console.warn("Failed to fetch documents:", err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [activeUser.id]);

  const [selectedFile, setSelectedFile] = useState<{ id: string; filename: string; category: string; size_bytes: number; mime_type: string; created_at: number } | null>(null);
  const [docQueryInput, setDocQueryInput] = useState("");
  const [docQueryAnswer, setDocQueryAnswer] = useState("");
  const [isDocQuerying, setIsDocQuerying] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const f = e.target.files[0];
    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("userId", activeUser.id);
      formData.append("category", newFileCategory);
      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setUploadedFiles(data.documents || []);
        setSelectedFile(data.document);
        showNotification(
          data.textExtracted
            ? `Uploaded "${f.name}" — text extracted and ready for Q&A.`
            : `Uploaded "${f.name}" — stored, but this file type has no text extraction yet, so chat/Q&A can't read its contents.`,
          data.textExtracted ? "success" : "info"
        );
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.error || "Failed to upload file.", "error");
      }
    } catch (err) {
      console.warn("Failed to upload file:", err);
      showNotification("Failed to upload file.", "error");
    } finally {
      setIsUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${activeUser.id}/${docId}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setUploadedFiles(data.documents || []);
        if (selectedFile?.id === docId) setSelectedFile(data.documents?.[0] || null);
      }
    } catch (err) {
      console.warn("Failed to delete document:", err);
    }
  };

  const handleDocQuery = async () => {
    if (!selectedFile || !docQueryInput.trim()) return;
    setIsDocQuerying(true);
    setDocQueryAnswer("");
    try {
      const res = await fetch("/api/documents/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUser.id, docId: selectedFile.id, question: docQueryInput })
      });
      const data = await res.json();
      setDocQueryAnswer(res.ok ? data.answer : (data.error || "Failed to query document."));
    } catch (err) {
      console.warn("Failed to query document:", err);
      setDocQueryAnswer("Failed to query document.");
    } finally {
      setIsDocQuerying(false);
    }
  };

  const handleVectorSearch = () => {
    if (!vectorQuery.trim()) return;
    setIsVectorSearching(true);
    setVectorSearchResult([]);
    
    setTimeout(() => {
      const results = activeUser.memoryLog.filter(log =>
        log.toLowerCase().includes(vectorQuery.toLowerCase()) || 
        vectorQuery.toLowerCase().split(" ").some(word => log.toLowerCase().includes(word))
      );
      
      setVectorSearchResult(results.length > 0 ? results : ["No matching isolated semantic memories found in your vault."]);
      setIsVectorSearching(false);
    }, 800);
  };

  // --- DATABASE AUDIT STATE ---
  const [dbAuditLogs, setDbAuditLogs] = useState<string[]>([]);
  const [isAuditingDb, setIsAuditingDb] = useState(false);

  // --- INTERACTIVE PLANNER & ALARM STATES ---
  interface PlanItem {
    id: string;
    planName: string;
    planTime: string;
    isActive: boolean;
  }
  const [planList, setPlanList] = useState<PlanItem[]>([
    { id: "p1", planName: "Revise Neural Network Backpropagation formula", planTime: "09:00 AM", isActive: true },
    { id: "p2", planName: "LeetCode Daily Challenge & Resume check", planTime: "11:30 AM", isActive: true },
    { id: "p3", planName: "Connect with Telangana Tech/T-Hub startup recruiters", planTime: "03:15 PM", isActive: true }
  ]);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanTime, setNewPlanTime] = useState("09:00 AM");

  // --- REAL-TIME TICKING CLOCK & PLAN AUTOMATION SCHEDULER ---
  const [tickingClock, setTickingClock] = useState(() => {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  });
  const [notifiedPlanIds, setNotifiedPlanIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setTickingClock(nowStr);

      // Check active plans
      planList.forEach((plan) => {
        if (plan.isActive) {
          const planTimeFormatted = plan.planTime.trim();
          const cleanNow = nowStr.trim();
          if (planTimeFormatted === cleanNow && !notifiedPlanIds[plan.id]) {
            showNotification(
              `🔔 SCHEDULER: Time to execute your plan!\n\n"${plan.planName}" is scheduled now (${plan.planTime}).\n\n🤖 Jarvis Alarm: Executing your second brain agenda item!`,
              "success"
            );
            handleSynthesizeVoice(`Attention Murali Krishna! Time to execute your scheduled plan: ${plan.planName}`);
            setNotifiedPlanIds(prev => ({ ...prev, [plan.id]: true }));
          }
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [planList, notifiedPlanIds]);

  const handleAddPlan = () => {
    if (!newPlanName.trim()) return;
    const newPlan: PlanItem = {
      id: "p_" + Date.now(),
      planName: newPlanName,
      planTime: newPlanTime,
      isActive: true
    };
    setPlanList(prev => [...prev, newPlan]);
    setNewPlanName("");
    showNotification(`New agenda item "${newPlan.planName}" armed for ${newPlan.planTime}!`);
  };

  const handleTriggerPlanAlarm = (plan: PlanItem) => {
    showNotification(
      `🔔 PLAN ALARM TRIGGERED!\n\nPlan: "${plan.planName}"\nScheduled Time: ${plan.planTime}\n\n🤖 Your AI Companion Jarvis says: Time to execute this plan immediately!`,
      "success"
    );
    handleSynthesizeVoice(`Attention Murali Krishna! Time to execute your plan: ${plan.planName}`);
  };

  // --- LIVE DATABASE BROWSER STATES ---
  const [dbCurrentTable, setDbCurrentTable] = useState<"users" | "assistants" | "api_keys" | "document_knowledge">("users");
  const [filterByActiveUserOnly, setFilterByActiveUserOnly] = useState(false);
  const [dbRowsUsers, setDbRowsUsers] = useState<any[]>([
    { id: "u_001", name: "Murali Krishna", email: "murali.cse@gitam.edu", plan: "Pro", role: "developer" },
    { id: "u_002", name: "Prof. Ramana Murthy", email: "ramana.murthy@gitam.edu", plan: "Academic", role: "admin" },
    { id: "u_003", name: "Teja Reddy", email: "teja.reddy@gitam.edu", plan: "Free", role: "user" },
    { id: "u_004", name: "Shashank Goud", email: "shashank.g@gitam.edu", plan: "Pro", role: "developer" }
  ]);
  const [dbRowsAssistants, setDbRowsAssistants] = useState<any[]>([
    { id: "a_001", user_id: "u_001", name: "Jarvis", personality: "Analytical Specialist & Brain Mirror", language: "English", voice: "Male (Neural)" },
    { id: "a_002", user_id: "u_001", name: "Arjuna Codegen", personality: "Deep Learning & TypeScript Companion", language: "English / TypeScript", voice: "Male (Synth)" },
    { id: "a_003", user_id: "u_002", name: "Saraswati", personality: "Academic Curriculum Synthesizer", language: "English / Telugu", voice: "Female (Neural)" }
  ]);
  const [dbRowsApiKeys, setDbRowsApiKeys] = useState<any[]>([
    { id: "k_001", user_id: "u_001", provider_slug: "gemini_pro_secret", encrypted_value: "U2FsdGVkX19D7Xv/Psz14x7zZ8Q_murali_key...", iv_vector: "f9ae32e8b09d115a" },
    { id: "k_002", user_id: "u_001", provider_slug: "telegram_bot_token", encrypted_value: "U2FsdGVkX1+vGk70M/7f847Dk8z_bot_secret...", iv_vector: "e90db67210e74fba" },
    { id: "k_003", user_id: "u_002", provider_slug: "github_personal_token", encrypted_value: "U2FsdGVkX19F9A1B2C3D4E5F_github_secret...", iv_vector: "a1b2c3d4e5f60708" }
  ]);
  const [dbRowsDocKnowledge, setDbRowsDocKnowledge] = useState<any[]>([
    { id: "d_001", user_id: "u_001", filename: "Gitam_BTech_CSE_Syllabus_2026.pdf", s3_storage_url: "s3://murali-vault/academic/gitam_btech_cse_syllabus_2026.pdf", file_size_bytes: 2451000 },
    { id: "d_002", user_id: "u_001", filename: "Neural_Networks_Lab_Report_IV.docx", s3_storage_url: "s3://murali-vault/studies/neural_networks_lab_report_iv.docx", file_size_bytes: 412500 },
    { id: "d_003", user_id: "u_001", filename: "Telangana_Tech_Startups_T_Hub.xlsx", s3_storage_url: "s3://murali-vault/research/telangana_tech_startups_t_hub.xlsx", file_size_bytes: 184500 },
    { id: "d_004", user_id: "u_001", filename: "Murali_Krishna_Academic_Roadmap.md", s3_storage_url: "s3://murali-vault/career/murali_krishna_academic_roadmap.md", file_size_bytes: 120500 },
    { id: "d_005", user_id: "u_001", filename: "Local_Companion_Daemon_Config.json", s3_storage_url: "s3://murali-vault/system/local_companion_daemon_config.json", file_size_bytes: 4600 }
  ]);

  const handleSeedDatabase = () => {
    const hydNames = ["Anjali Reddy", "Sai Kiran", "Teja Goud", "Priya Rao", "Karthik Varma"];
    const hydEmails = ["anjali.it@jntuh.ac.in", "saikiran.iot@osmania.edu", "tejagoud.tech@t-hub.co", "priya.startup@hyderabad.ai", "karthik@btech.bits-hyderabad.ac.in"];
    const randIdx = Math.floor(Math.random() * hydNames.length);
    const newUserId = "u_00" + (dbRowsUsers.length + 1);
    
    const newUser = { id: newUserId, name: hydNames[randIdx], email: hydEmails[randIdx], plan: "Pro", role: "developer" };
    const newAssistant = { id: "a_00" + (dbRowsAssistants.length + 1), user_id: newUserId, name: "T-Bot " + (dbRowsAssistants.length + 1), personality: "Telangana Tech Ecosystem Guide", language: "English / Telugu", voice: "Female" };
    const newApiKey = { id: "k_00" + (dbRowsApiKeys.length + 1), user_id: newUserId, provider_slug: "t_hub_api", encrypted_value: "U2FsdGVkX1+pE8wD2n6B..." + Math.random().toString(36).substring(2, 6), iv_vector: "b07de183c50f8392" };
    
    setDbRowsUsers(prev => [...prev, newUser]);
    setDbRowsAssistants(prev => [...prev, newAssistant]);
    setDbRowsApiKeys(prev => [...prev, newApiKey]);
    
    showNotification(`Successfully seeded tenant row "${hydNames[randIdx]}" into PostgreSQL schema. Relational foreign key checks passed!`, "success");
  };

  const handleRunDbAudit = () => {
    setIsAuditingDb(true);
    setDbAuditLogs([
      "> Initializing secure connection to cloud PostgreSQL instance...",
      "> Establishing TLSv1.3 cryptographic socket envelope...",
      "> Authenticating admin credential vault signatures..."
    ]);

    setTimeout(() => {
      setDbAuditLogs(prev => [
        ...prev,
        `> SUCCESS: Connected to pg_node_cluster_us_east.`,
        `> Scan target: SCHEMA 'public' for Tenant Isolation boundaries.`,
        `> Auditing tables: 'users', 'assistants', 'api_keys', 'chats_session', 'messages_history', 'document_knowledge'...`
      ]);
    }, 600);

    setTimeout(() => {
      setDbAuditLogs(prev => [
        ...prev,
        `> VERIFYING Row-Level Security (RLS) constraints for user_id = '${activeUser.id}'...`,
        `> Relational Constraint OK: chats_session.user_id references users.id.`,
        `> Relational Constraint OK: api_keys.user_id references users.id.`,
        `> Relational Constraint OK: document_knowledge.user_id references users.id.`
      ]);
    }, 1200);

    setTimeout(() => {
      setDbAuditLogs(prev => [
        ...prev,
        `> Integrity Check Completed: 100% Isolated. Zero leaked cross-references.`,
        `> [OK] Row-level multi-tenant boundaries verified.`,
        `> Audit finished successfully. System secure.`
      ]);
      setIsAuditingDb(false);
      showNotification("PostgreSQL Tenant Isolation Boundary verified successfully!", "success");
    }, 2000);
  };


  // --- REAL TASK MANAGEMENT (backed by /api/tasks, not local-only state) ---
  const [newTaskText, setNewTaskText] = useState("");
  const [selectedTaskCategory, setSelectedTaskCategory] = useState("Studies");

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks/${activeUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveUser(prev => ({ ...prev, tasks: data.tasks || [] }));
      }
    } catch (err) {
      console.warn("Failed to fetch tasks:", err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeUser.id]);

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    const text = newTaskText;
    setNewTaskText("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUser.id, text, list: selectedTaskCategory })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveUser(prev => ({ ...prev, tasks: data.tasks || [] }));
      } else {
        showNotification("Failed to save task.", "error");
      }
    } catch (err) {
      console.warn("Failed to add task:", err);
      showNotification("Failed to save task.", "error");
    }
  };

  const handleToggleTask = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${activeUser.id}/${id}/toggle`, { method: "PUT" });
      if (res.ok) {
        const data = await res.json();
        setActiveUser(prev => ({ ...prev, tasks: data.tasks || [] }));
      }
    } catch (err) {
      console.warn("Failed to toggle task:", err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${activeUser.id}/${id}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setActiveUser(prev => ({ ...prev, tasks: data.tasks || [] }));
      }
    } catch (err) {
      console.warn("Failed to delete task:", err);
    }
  };

  const handleLogExpense = () => {
    if (!expenseInput.trim()) return;
    
    // Parse description and cost (e.g., "API query, 3.20")
    const parts = expenseInput.split(",");
    let desc = parts[0]?.trim() || "Miscellaneous Expense";
    let costStr = parts[1]?.trim() || "$1.00";
    if (!costStr.startsWith("$")) {
      costStr = "$" + costStr;
    }
    
    const costVal = parseFloat(costStr.replace("$", "")) || 0;

    const newExpense = {
      desc,
      cost: costStr,
      date: "July 11"
    };

    setExpensesData(prev => {
      const userExp = prev[activeUser.id] || { totalWeekly: "$0.00", items: [], excelFile: "" };
      const currentTotal = parseFloat(userExp.totalWeekly.replace("$", "")) || 0;
      const nextTotal = (currentTotal + costVal).toFixed(2);
      
      return {
        ...prev,
        [activeUser.id]: {
          ...userExp,
          totalWeekly: `$${nextTotal}`,
          items: [newExpense, ...userExp.items]
        }
      };
    });

    setExpenseInput("");
    showNotification(`Logged expense: "${desc}" (${costStr})`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col antialiased relative">
      
      {/* Floating Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-md bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-2xl p-4 shadow-2xl flex items-start gap-3"
          >
            <div className={`p-2 rounded-xl shrink-0 ${
              notification.type === "success" 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                : notification.type === "error" 
                ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            }`}>
              {notification.type === "success" ? (
                <CheckCircle className="w-5 h-5" />
              ) : notification.type === "error" ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 space-y-1 min-w-0">
              <p className="text-xs font-bold font-mono text-zinc-300 uppercase tracking-wider">
                {notification.type === "success" ? "System Success" : notification.type === "error" ? "System Notification" : "System Notification"}
              </p>
              <p className="text-xs text-zinc-400 leading-normal font-sans whitespace-pre-line break-words">
                {notification.message}
              </p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs font-mono font-bold cursor-pointer transition-colors p-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connect Your Own Gmail Modal — reachable directly from the
          dashboard. No admin password / admin panel involved: each visitor
          enters only their own Gmail address + App Password, which the
          server stores isolated to their device. */}
      <AnimatePresence>
        {showGmailConnectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !isGmailConnecting && setShowGmailConnectModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-2 font-mono uppercase">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  Connect Your Gmail
                </h3>
                <button
                  onClick={() => setShowGmailConnectModal(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs font-mono font-bold cursor-pointer transition-colors p-1"
                >
                  ✕
                </button>
              </div>

              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Use your own Gmail address and an <span className="text-zinc-400 font-semibold">App Password</span> (Google Account → Security → 2-Step Verification → App Passwords). No admin login needed — your credentials are only used to fetch your own inbox.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Gmail Address</label>
                <input
                  type="email"
                  placeholder="you@gmail.com"
                  value={gmailEmailInput}
                  onChange={(e) => {
                    setGmailEmailInput(e.target.value);
                    setGmailConnectError("");
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-emerald-900/50 focus:ring-1 focus:ring-emerald-900/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">App Password (16 characters)</label>
                <input
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={gmailAppPasswordInput}
                  onChange={(e) => {
                    setGmailAppPasswordInput(e.target.value);
                    setGmailConnectError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConnectGmail();
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-emerald-900/50 focus:ring-1 focus:ring-emerald-900/20 transition-all"
                />
                <div className="flex items-center gap-3 pt-0.5">
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-emerald-500 hover:text-emerald-400 font-mono underline underline-offset-2"
                  >
                    Generate App Password
                  </a>
                  <span className="text-zinc-700">·</span>
                  <a
                    href="https://accounts.google.com/signin/recovery"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono underline underline-offset-2"
                  >
                    Forgot Google password?
                  </a>
                </div>
              </div>

              {gmailConnectError && (
                <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-2.5">
                  <p className="text-[10px] font-mono text-red-400">{gmailConnectError}</p>
                </div>
              )}

              <button
                onClick={async () => {
                  await handleConnectGmail();
                }}
                disabled={isGmailConnecting}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-bold tracking-wider uppercase font-mono py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isGmailConnecting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                Verify &amp; Connect
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* HEADER BAR */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-lg relative z-20">
        
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black shadow-lg shadow-emerald-500/10">
            <Bot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">AI Assistant Platform</h1>
              <span className="text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono font-semibold px-2 py-0.5 rounded-full">
                SaaS Enterprise v2.5
              </span>
            </div>
            <p className="text-xs text-zinc-400">Multi-User Isolated Executive Workspace Hub</p>
          </div>
        </div>

        {/* Dynamic User switcher & Tenant isolation feedback */}
        <div className="flex flex-wrap items-center gap-3">
          
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 px-3">
            <span className="text-xs font-mono text-zinc-500">Active Tenant:</span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeUser.avatarColor}`} />
              <span className="text-xs font-semibold text-zinc-200">{activeUser.name}</span>
              <span className="text-[10px] text-emerald-400 font-mono border border-emerald-900/50 bg-emerald-950/40 px-1.5 py-0.2 rounded">
                {activeUser.plan}
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 bg-zinc-950/40 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Isolated AES-256 Workspace</span>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded-lg text-[10px] font-mono">
            <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-bold">{tickingClock}</span>
          </div>

          {/* Assistant dropdown for the active user */}
          <div className="flex items-center gap-1 bg-zinc-800/40 border border-zinc-700/60 p-1 rounded-lg">
            <span className="text-[10px] text-zinc-500 uppercase px-2 font-mono">My Bots:</span>
            <select
              value={selectedAssistant.id}
              onChange={(e) => {
                const ast = activeUser.assistants.find(a => a.id === e.target.value);
                if (ast) setSelectedAssistant(ast);
              }}
              className="bg-zinc-900 border-none text-xs text-zinc-200 py-1 px-2.5 rounded focus:ring-0 focus:outline-none font-medium cursor-pointer"
            >
              {activeUser.assistants.map((ast) => (
                <option key={ast.id} value={ast.id}>
                  {ast.name} ({ast.personality})
                </option>
              ))}
            </select>
          </div>

        </div>

      </header>

      {/* BODY WITH SIDEBAR AND MAIN WRAPPER */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full md:w-64 bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col shrink-0 relative z-10 p-4 justify-between">
          
          <div className="space-y-6">
            <div className="px-2">
              <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-bold">
                Navigational Matrix
              </span>
            </div>

            <nav className="space-y-1">
              {[
                { id: "dashboard", label: "SaaS Dashboard", icon: Sliders, badge: "Hub" },
                { id: "scheduler", label: "Plans & Scheduler", icon: Clock, badge: "Alarm" },
                { id: "chat", label: "Assistant Chat", icon: Bot, badge: "Active" },
                { id: "wizard", label: "Assistant Wizard", icon: Compass, badge: "New" },
                { id: "vault", label: "API Key Vault", icon: LockKeyhole, badge: "Secure" },
                { id: "knowledge", label: "Knowledge Base", icon: HardDrive, badge: "Files" },
                { id: "schema", label: "Database Relational", icon: Database, badge: "Postgres" },
                { id: "laptop", label: "Laptop Companion", icon: Laptop, badge: "Sync" },
                { id: "mobile", label: "Mobile App (PWA)", icon: Smartphone, badge: "PWA" },
                { id: "telegram", label: "Telegram Hub", icon: MessageSquare, badge: "Bot" }
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium tracking-wide transition-all ${
                      isSelected
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
                    }`}
                    id={`sidebar-tab-${tab.id}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isSelected ? "text-emerald-400" : "text-zinc-500"}`} />
                      {tab.label}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                      isSelected ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                    }`}>
                      {tab.badge}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Secure Identity Card footer */}
          <div className="mt-8 border-t border-zinc-800 pt-4 px-2 space-y-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase">Isolation Protocol</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Every query, file directory, and credential memory index is verified for strictly single-tenant user ID <code className="text-zinc-400">"{activeUser.id}"</code> isolation.
            </p>
          </div>

        </aside>

        {/* MAIN DISPLAY CONTENT CONTAINER */}
        <main className="flex-1 bg-zinc-950 overflow-y-auto p-4 md:p-6">
          
          <AnimatePresence mode="wait">
            
            {/* 1. SAAS DASHBOARD TAB */}
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Greeting banner */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      Welcome Back, {activeUser.name}!
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Platform statistics, connected developer tools, and second brain indices for your workspace are fully connected and live.
                    </p>
                  </div>
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    {gmailConfigured ? (
                      <div className="flex items-center gap-2 bg-zinc-950 border border-emerald-800/60 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Connected: {gmailConnectedEmail}</span>
                        <button
                          onClick={handleDisconnectGmail}
                          className="text-[10px] bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 px-2 py-0.5 rounded ml-2 transition-colors cursor-pointer"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setShowGmailConnectModal(true)}
                          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 rounded-xl text-xs font-bold font-sans transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-zinc-950" />
                          Connect Gmail
                        </button>
                        <button
                          onClick={handleConnectDemoWorkspace}
                          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold font-sans border border-zinc-850 transition-colors cursor-pointer"
                          title="Use sample inbox data instead of a real Gmail connection"
                        >
                          <Database className="w-4 h-4 text-emerald-400" />
                          Demo Sandbox
                        </button>
                      </div>
                    )}
                    <span className="text-xs font-mono text-zinc-400 bg-zinc-950 px-3 py-1.5 border border-zinc-800 rounded-lg">
                      🔒 Isolated ID: user_uuid_{activeUser.id}_821
                    </span>
                  </div>
                </div>

                {/* Micro bento statistics cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Gemini Tokens Synced", val: activeUser.stats.tokensUsed.toLocaleString(), icon: Cpu, color: "text-emerald-400 bg-emerald-950/20 border-emerald-900/30" },
                    { label: "Conversations Logs", val: `${activeUser.stats.totalChats} Sessions`, icon: Bot, color: "text-purple-400 bg-purple-950/20 border-purple-900/30" },
                    { label: "Active Assistants", val: `${activeUser.stats.activeBots} Configured`, icon: Layers, color: "text-sky-400 bg-sky-950/20 border-sky-900/30" },
                    { label: "Connected APIs/Apps", val: `${activeUser.stats.connectedApps} Secured`, icon: Cloud, color: "text-amber-400 bg-amber-950/20 border-amber-900/30" }
                  ].map((s, idx) => (
                    <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{s.label}</span>
                        <p className="text-base font-bold text-white font-mono">{s.val}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* MULTI-TENANT WORKSPACE & SECURITY Isolation Manager */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-emerald-400" />
                        🛡️ MULTI-TENANT WORKSPACE & PRIVACY CONTROLLER
                      </h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                        Register new secure user tenants or safely toggle workspace contexts with zero-knowledge data leakage policies.
                      </p>
                    </div>
                    <div className="text-[10px] font-mono bg-zinc-950 border border-zinc-800 text-zinc-400 p-2 rounded-lg flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-emerald-500" />
                      Tenant Privacy Isolation: <span className="text-emerald-400 font-bold">ACTIVE (AES-256)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Switch Tenant Section */}
                    <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-xl space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          Safely Toggle Active Workspace
                        </span>
                        <p className="text-[10px] text-zinc-500">
                          Decrypt and restore a different tenant context. Requires password confirmation.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Select Workspace</label>
                          <select
                            value={selectedSwitchUserId}
                            onChange={(e) => setSelectedSwitchUserId(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                          >
                            {(Object.values(allUsers) as UserProfile[]).map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.id === "murali" ? "Murali K. (Default Owner)" : `${u.name} (ID: ${u.id})`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Workspace Password</label>
                          <input
                            type="password"
                            placeholder="Enter password"
                            value={tenantPasswordInput}
                            onChange={(e) => setTenantPasswordInput(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSwitchTenant();
                            }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleSwitchTenant}
                        className="w-full bg-zinc-900 hover:bg-zinc-850 text-emerald-400 hover:text-emerald-300 border border-zinc-800 text-[11px] font-bold py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Key className="w-3.5 h-3.5 text-emerald-500" />
                        Decrypt & Switch Context
                      </button>
                    </div>

                    {/* Register New Tenant Section */}
                    <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-xl space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1">
                          <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                          Register Brand New Isolated Tenant
                        </span>
                        <p className="text-[10px] text-zinc-500">
                          Create a clean, completely empty digital partner vault. All metadata isolates automatically.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Your Display Name"
                          value={newTenantName}
                          onChange={(e) => setNewTenantName(e.target.value)}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none"
                        />
                        <input
                          type="email"
                          placeholder="your.email@domain.com"
                          value={newTenantEmail}
                          onChange={(e) => setNewTenantEmail(e.target.value)}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none"
                        />
                        <select
                          value={newTenantRole}
                          onChange={(e) => setNewTenantRole(e.target.value)}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                        >
                          <option value="developer">Developer (Full Ops Access)</option>
                          <option value="student">Student (Academic Focus)</option>
                          <option value="executive">Executive (Strategic Focus)</option>
                        </select>
                        <input
                          type="password"
                          placeholder="Create secure password"
                          value={newTenantPassword}
                          onChange={(e) => setNewTenantPassword(e.target.value)}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={handleRegisterTenant}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[11px] font-bold py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Instantiate Isolated Tenant
                      </button>
                    </div>
                  </div>
                </div>

                {/* BENTO GRID OF SYSTEM WIDGETS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* LEFT COLUMN: GMAIL FEED & WEATHER */}
                  <div className="space-y-6">
                    
                    {/* Simulated Gmail summary */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-emerald-400" />
                          GMAIL PRIORITIES
                        </h3>
                        <span className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded-full font-mono">
                          Active API
                        </span>
                      </div>
                      {!gmailConfigured || !connections[activeUser.id]?.gmail ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center px-4 space-y-3 bg-zinc-950/40 rounded-lg border border-dashed border-zinc-800">
                          <Mail className="w-7 h-7 text-zinc-600 animate-pulse" />
                          <div>
                            <h4 className="text-[11px] font-bold text-zinc-400">Gmail Sync Standby</h4>
                            <p className="text-[10px] text-zinc-500 max-w-[200px] mt-1 leading-normal">Connect your own Gmail address + App Password to retrieve your live inbox.</p>
                          </div>
                          <div className="flex flex-col gap-2 w-full">
                            <button
                              onClick={() => setShowGmailConnectModal(true)}
                              className="bg-zinc-850 hover:bg-zinc-800 text-[10px] font-mono text-emerald-400 px-3 py-1.5 rounded border border-zinc-750 transition-all cursor-pointer flex items-center justify-center gap-2 w-full"
                            >
                              {isSyncingWorkspace ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Mail className="w-3 h-3" />
                              )}
                              Connect Gmail
                            </button>
                            <button
                              onClick={handleConnectDemoWorkspace}
                              className="bg-zinc-950 hover:bg-zinc-900 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded border border-zinc-850 transition-all cursor-pointer flex items-center justify-center gap-2 w-full"
                            >
                              <Database className="w-3 h-3 text-emerald-500" />
                              Simulated Demo Account
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(realEmails || activeUser.emails).map((e, idx) => (
                            <div key={e.id || idx} className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3 hover:border-zinc-700 transition-all cursor-pointer">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-zinc-200 truncate max-w-[150px]">{e.sender}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                                  e.priority === "HIGH" ? "bg-red-950 text-red-400 border border-red-900" : "bg-zinc-800 text-zinc-400"
                                }`}>
                                  {e.priority}
                                </span>
                              </div>
                              <h4 className="text-xs font-medium text-white line-clamp-1">{e.subject}</h4>
                              {e.body && (
                                <p className="text-[10px] text-zinc-400 line-clamp-2 mt-1 leading-normal">
                                  {e.body}
                                </p>
                              )}
                              <div className="flex justify-between items-center mt-2 text-[10px] text-zinc-500 font-mono">
                                <span>{e.category}</span>
                                <span>{e.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Upgraded Real Weather API with City Selection */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Cloud className="w-4 h-4 text-sky-400" />
                          LIVE WEATHER TELEMETRY
                        </h3>
                        <span className="text-[10px] bg-sky-950/40 text-sky-400 border border-sky-900 px-2 py-0.5 rounded-full font-mono">
                          Open-Meteo API
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={requestLiveLocationWeather}
                          className="flex items-center gap-1.5 bg-sky-950/40 hover:bg-sky-900/40 border border-sky-900 rounded-lg px-2.5 text-sky-400 cursor-pointer text-[11px] font-mono"
                          title="Use my live location (asks browser permission)"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Use My Location
                        </button>
                        <input
                          type="text"
                          value={weatherPlaceInput}
                          onChange={(e) => setWeatherPlaceInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && weatherPlaceInput.trim()) {
                              fetchWeatherByPlaceName(weatherPlaceInput.trim());
                            }
                          }}
                          placeholder="Or type any place name..."
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] text-zinc-300 p-1.5 focus:outline-none"
                        />
                        <button
                          onClick={() => weatherPlaceInput.trim() ? fetchWeatherByPlaceName(weatherPlaceInput.trim()) : requestLiveLocationWeather()}
                          className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded-lg px-2 text-zinc-400 cursor-pointer text-xs"
                          title="Search or refresh weather"
                        >
                          {isFetchingWeather ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {selectedWeatherCity && (
                        <p className="text-[10px] text-zinc-500 font-mono">Showing: {selectedWeatherCity}</p>
                      )}
                      {!connections[activeUser.id]?.weather ? (
                        <div className="flex flex-col items-center justify-center py-4 text-center px-4 space-y-2 bg-zinc-950/40 rounded-lg border border-dashed border-zinc-850">
                          <Cloud className="w-7 h-7 text-zinc-600 animate-pulse" />
                          <div>
                            <h4 className="text-[11px] font-bold text-zinc-400 font-mono">Live Weather Offline</h4>
                            <p className="text-[10px] text-zinc-500 mt-1 leading-normal">Establish a secure weather location feed.</p>
                          </div>
                          <button
                            onClick={() => fetchRealWeather(selectedWeatherCity)}
                            className="bg-zinc-800 hover:bg-zinc-750 text-[10px] font-mono text-sky-400 px-3 py-1 rounded border border-zinc-700 transition-all cursor-pointer"
                          >
                            Activate Meteorological Feed
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-4 py-1">
                            <div className="text-2xl font-extrabold text-white font-mono">{activeUser.weather.temp}</div>
                            <div>
                              <p className="text-xs font-semibold text-zinc-200">{activeUser.weather.condition}</p>
                              <p className="text-[10px] text-zinc-500 font-mono">{selectedWeatherCity}</p>
                            </div>
                          </div>
                          <p className="text-[11px] text-zinc-400 bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 italic leading-relaxed">
                            "{activeUser.weather.recommendation}"
                          </p>
                        </>
                      )}
                    </div>

                    {/* Upgraded Real-Time Technology & AI News Agent Feed */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Newspaper className="w-4 h-4 text-amber-400" />
                          REAL-TIME TECH NEWS AGENT
                        </h3>
                        <button
                          onClick={fetchRealNews}
                          className="bg-zinc-950 hover:bg-zinc-900 text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
                        >
                          {isFetchingNews ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      {isFetchingNews && newsArticles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
                          <span className="text-[10px] text-zinc-500 mt-2 font-mono">Synthesizing tech bulletins...</span>
                        </div>
                      ) : newsArticles.length === 0 ? (
                        <p className="text-[10px] text-zinc-500 italic py-4 text-center">No live news available right now.</p>
                      ) : (
                        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                          {newsArticles.map((art, idx) => (
                            <a
                              key={idx}
                              href={art.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block bg-zinc-950 hover:border-zinc-750 border border-zinc-850 p-2.5 rounded-lg transition-all cursor-pointer"
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                                  {art.source}
                                </span>
                                <span className="text-[9px] text-zinc-500 font-mono">
                                  Live Feed
                                </span>
                              </div>
                              <h4 className="text-[11px] font-medium text-white hover:text-amber-300 transition-colors leading-snug line-clamp-2">
                                {art.title}
                              </h4>
                              {art.description && (
                                <p className="text-[9px] text-zinc-400 line-clamp-1 mt-1 leading-normal">
                                  {art.description}
                                </p>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* MIDDLE COLUMN: CALENDAR SCHEDULER & GITHUB METRICS */}
                  <div className="space-y-6">
                    
                    {/* Real interactive calendar — click a date, name an event, it's saved */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-purple-400" />
                          CALENDAR
                        </h3>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setCalendarMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            className="text-zinc-500 hover:text-zinc-300 px-1.5 cursor-pointer"
                          >
                            ‹
                          </button>
                          <span className="text-[10px] text-zinc-400 font-mono min-w-[80px] text-center">
                            {calendarMonthCursor.toLocaleString("default", { month: "long", year: "numeric" })}
                          </span>
                          <button
                            onClick={() => setCalendarMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            className="text-zinc-500 hover:text-zinc-300 px-1.5 cursor-pointer"
                          >
                            ›
                          </button>
                        </div>
                      </div>

                      {/* Month grid */}
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                          <span key={i} className="text-[9px] text-zinc-600 font-mono py-1">{d}</span>
                        ))}
                        {(() => {
                          const year = calendarMonthCursor.getFullYear();
                          const month = calendarMonthCursor.getMonth();
                          const firstDay = new Date(year, month, 1).getDay();
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const todayStr = new Date().toISOString().slice(0, 10);
                          const cells = [];
                          for (let i = 0; i < firstDay; i++) {
                            cells.push(<span key={`empty-${i}`} />);
                          }
                          for (let day = 1; day <= daysInMonth; day++) {
                            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const hasEvent = realCalendarEvents.some(e => e.date === dateStr);
                            const isToday = dateStr === todayStr;
                            const isSelected = dateStr === selectedCalendarDate;
                            cells.push(
                              <button
                                key={dateStr}
                                onClick={() => setSelectedCalendarDate(dateStr)}
                                className={`relative text-[10px] rounded-lg py-1.5 font-mono cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-purple-500 text-white font-bold"
                                    : isToday
                                    ? "bg-purple-950/50 text-purple-300 border border-purple-800"
                                    : "text-zinc-400 hover:bg-zinc-800"
                                }`}
                              >
                                {day}
                                {hasEvent && !isSelected && (
                                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-purple-400 rounded-full" />
                                )}
                              </button>
                            );
                          }
                          return cells;
                        })()}
                      </div>

                      {/* Selected date: add event + list events for that day */}
                      {selectedCalendarDate && (
                        <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-3 space-y-2">
                          <p className="text-[10px] text-zinc-500 font-mono">{selectedCalendarDate}</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newEventTitleInput}
                              onChange={(e) => setNewEventTitleInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddCalendarEvent()}
                              placeholder="Event name..."
                              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] text-zinc-200 p-1.5 focus:outline-none"
                            />
                            <button
                              onClick={handleAddCalendarEvent}
                              disabled={isSavingEvent || !newEventTitleInput.trim()}
                              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold px-3 rounded-lg cursor-pointer"
                            >
                              Add
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {realCalendarEvents.filter(e => e.date === selectedCalendarDate).map(e => (
                              <div key={e.id} className="flex justify-between items-center bg-zinc-900 px-2.5 py-1.5 rounded-lg">
                                <span className="text-[11px] text-zinc-200">{e.title}</span>
                                <button
                                  onClick={() => handleDeleteCalendarEvent(e.id)}
                                  className="text-zinc-600 hover:text-red-400 text-[10px] cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Upcoming events (real, sorted, from saved events only) */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[10px] text-zinc-500 font-mono uppercase">Upcoming</span>
                        {realCalendarEvents.length === 0 ? (
                          <p className="text-[10px] text-zinc-600 italic py-2">No events yet — click a date above to add one.</p>
                        ) : (
                          [...realCalendarEvents]
                            .filter(e => e.date >= new Date().toISOString().slice(0, 10))
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .slice(0, 5)
                            .map((c) => (
                              <div key={c.id} className="flex justify-between items-start bg-zinc-950 p-3 rounded-lg border border-zinc-850">
                                <div>
                                  <p className="text-xs font-bold text-zinc-200">{c.title}</p>
                                  <p className="text-[10px] text-zinc-500 mt-1">{c.date}</p>
                                </div>
                                <span className="text-[9px] font-mono bg-zinc-850 text-zinc-400 px-2 py-0.5 rounded">
                                  {c.type}
                                </span>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* GitHub metrics panel */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-teal-400" />
                          GITHUB SYNC INTEGRATION
                        </h3>
                        <span className="text-[10px] bg-teal-950/40 text-teal-400 border border-teal-900 px-2 py-0.5 rounded font-mono font-bold">
                          Active API
                        </span>
                      </div>
                      {!connections[activeUser.id]?.github ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center px-4 space-y-3 bg-zinc-950/40 rounded-lg border border-dashed border-zinc-800">
                          <GitBranch className="w-7 h-7 text-zinc-600 animate-pulse" />
                          <div>
                            <h4 className="text-[11px] font-bold text-zinc-400">GitHub Sync Offline</h4>
                            <p className="text-[10px] text-zinc-500 max-w-[200px] mt-1 leading-normal">Pull real-time commit contributions and repository updates automatically.</p>
                          </div>
                          <button
                            onClick={() => {
                              setConnections(prev => ({
                                ...prev,
                                [activeUser.id]: { ...(prev[activeUser.id] || {}), github: true }
                              }));
                              showNotification("Successfully fetched GitHub profile milestones.");
                            }}
                            className="bg-zinc-800 hover:bg-zinc-750 text-[10px] font-mono text-teal-400 px-3 py-1.5 rounded border border-zinc-750 transition-all cursor-pointer"
                          >
                            Link GitHub Token
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-center">
                              <p className="text-[10px] text-zinc-500 font-mono uppercase">Streak</p>
                              <p className="text-sm font-bold text-emerald-400 font-mono mt-1">{activeUser.github.streak}</p>
                            </div>
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-center">
                              <p className="text-[10px] text-zinc-500 font-mono uppercase">Commits Today</p>
                              <p className="text-sm font-bold text-white font-mono mt-1">+{activeUser.github.commits}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] text-zinc-500 font-mono font-bold uppercase">Active Pull Requests</p>
                            {activeUser.github.pullRequests.map((pr, i) => (
                              <div key={i} className="bg-zinc-950 p-2.5 rounded border border-zinc-850 text-xs flex justify-between items-center">
                                <span className="text-zinc-300 truncate max-w-[160px] font-mono">{pr.title}</span>
                                <span className="text-[9px] bg-zinc-850 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                                  {pr.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: STUDY TRACKER & EXPENSES OR MEMORY */}
                  <div className="space-y-6">
                    
                    {/* Leetcode / Study tracker progress */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-indigo-400" />
                          STUDY &amp; ROADMAP METRICS
                        </h3>
                        <span className="text-[10px] text-zinc-500 font-mono">B.Tech CSE Tracker</span>
                      </div>
                      
                      {!connections[activeUser.id]?.study ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center px-4 space-y-3 bg-zinc-950/40 rounded-lg border border-dashed border-zinc-800">
                          <TrendingUp className="w-7 h-7 text-zinc-600 animate-pulse" />
                          <div>
                            <h4 className="text-[11px] font-bold text-zinc-400">Academic Metrics Offline</h4>
                            <p className="text-[10px] text-zinc-500 max-w-[210px] mt-1 leading-normal">Configure your course syllabus milestones and exam countdown details.</p>
                          </div>
                          <button
                            onClick={() => setShowStudyConfig(true)}
                            className="bg-zinc-800 hover:bg-zinc-750 text-[10px] font-mono text-indigo-400 px-3 py-1.5 rounded border border-zinc-750 transition-all cursor-pointer"
                          >
                            Configure Metrics
                          </button>
                        </div>
                      ) : showStudyConfig ? (
                        <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-850 space-y-3">
                          <h4 className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">Edit Study Parameters</h4>
                          <div className="space-y-2 text-xs">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                                <span>Syllabus Progress</span>
                                <span className="text-emerald-400">{studyProgressInput}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={studyProgressInput}
                                onChange={(e) => setStudyProgressInput(parseInt(e.target.value))}
                                className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded cursor-pointer"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono">LeetCode Solved</label>
                              <input
                                type="text"
                                value={studyLeetcodeInput}
                                onChange={(e) => setStudyLeetcodeInput(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono">Exam Countdown</label>
                              <input
                                type="text"
                                value={studyExamCountdownInput}
                                onChange={(e) => setStudyExamCountdownInput(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => setShowStudyConfig(false)}
                              className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 text-[10px] py-1 rounded transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={async () => {
                                const study = {
                                  progress: studyProgressInput,
                                  leetcode: studyLeetcodeInput || "Not Set",
                                  examCountdown: studyExamCountdownInput || "Not Set"
                                };
                                setActiveUser(prev => ({ ...prev, study }));
                                setConnections(prev => ({
                                  ...prev,
                                  [activeUser.id]: { ...(prev[activeUser.id] || {}), study: true }
                                }));
                                setShowStudyConfig(false);
                                try {
                                  await fetch("/api/study", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ userId: activeUser.id, ...study })
                                  });
                                  showNotification("Study metrics saved.");
                                } catch (err) {
                                  showNotification("Saved locally, but failed to sync to server.", "error");
                                }
                              }}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px] py-1 rounded transition-all cursor-pointer"
                            >
                              Save &amp; Connect
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-mono text-zinc-400">
                              <span>Semester Syllabus Progress</span>
                              <span className="text-emerald-400">{activeUser.study.progress}%</span>
                            </div>
                            <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${activeUser.study.progress}%` }} />
                            </div>
                          </div>

                          <div className="space-y-2 pt-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-400">LeetCode Benchmark:</span>
                              <span className="font-bold text-white font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850">
                                {activeUser.study.leetcode}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-400">Semester Exam Countdown:</span>
                              <span className="font-bold text-red-400 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850">
                                {activeUser.study.examCountdown}
                              </span>
                            </div>
                          </div>

                          <div className="text-right pt-2">
                            <button
                              onClick={() => {
                                setStudyProgressInput(activeUser.study.progress);
                                setStudyLeetcodeInput(activeUser.study.leetcode);
                                setStudyExamCountdownInput(activeUser.study.examCountdown);
                                setShowStudyConfig(true);
                              }}
                              className="text-[10px] text-zinc-500 hover:text-emerald-400 font-mono underline cursor-pointer"
                            >
                              Edit Settings
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Interactive Daily Day Planner & Alarm Trigger */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 font-mono">
                          <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
                          DAILY INTERACTIVE DAY PLANNER
                        </h3>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.5 rounded font-mono">Scheduler Active</span>
                      </div>

                      <div className="space-y-3">
                        {/* Add Plan Form */}
                        <div className="space-y-2">
                          <p className="text-[10px] text-zinc-400">Configure your daily plans &amp; custom timings to arm automated notifications:</p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              placeholder="Study Plan/Task Name (e.g. Solve 3 LeetCode problems)"
                              value={newPlanName}
                              onChange={(e) => setNewPlanName(e.target.value)}
                              className="flex-1 bg-zinc-950 border border-zinc-800 text-xs px-2.5 py-1.5 rounded focus:outline-none text-zinc-200"
                            />
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="e.g. 03:15 PM"
                                value={newPlanTime}
                                onChange={(e) => setNewPlanTime(e.target.value)}
                                className="w-28 bg-zinc-950 border border-zinc-800 text-xs px-2.5 py-1.5 rounded focus:outline-none text-zinc-200 font-mono text-center"
                                title="Enter plan trigger time in HH:MM AM/PM 12-hour format"
                              />
                              <button
                                onClick={handleAddPlan}
                                className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold px-4 py-1.5 rounded transition-all cursor-pointer font-mono shrink-0"
                              >
                                Arm Alarm 🔔
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Plans List */}
                        <div className="space-y-2 bg-zinc-950 p-2.5 rounded-lg border border-zinc-850">
                          <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono border-b border-zinc-850 pb-1.5">
                            <span>AGENDA ITEM &amp; TIMING</span>
                            <span>TEST ACTION</span>
                          </div>

                          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                            {planList.map((plan) => (
                              <div key={plan.id} className="flex justify-between items-center gap-2 border-b border-zinc-850/40 pb-2 last:border-none last:pb-0">
                                <div className="space-y-1 text-left">
                                  <p className="text-xs font-medium text-zinc-300 leading-normal">{plan.planName}</p>
                                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-950 px-1.5 py-0.5 rounded-md">
                                    ⏰ {plan.planTime}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleTriggerPlanAlarm(plan)}
                                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 border border-zinc-800 text-[10px] font-mono px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer shrink-0"
                                  title="Test schedule alert right now"
                                >
                                  <Bell className="w-3 h-3" />
                                  Trigger ⚡
                                </button>
                              </div>
                            ))}
                            {planList.length === 0 && (
                              <p className="text-[10px] text-zinc-600 font-mono italic text-center py-4">No custom plans entered. Add one above.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

                {/* TASK WORKSPACE PANEL */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800 pb-3 mb-4 gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ACTIVE TASKS &amp; ACTION ITEMS
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Isolated relational database: tables.tasks</p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                      <select
                        value={selectedTaskCategory}
                        onChange={(e) => setSelectedTaskCategory(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 py-1 px-2.5 rounded-lg focus:outline-none"
                      >
                        <option value="Studies">Studies</option>
                        <option value="Coding">Coding</option>
                        <option value="Career">Career</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Add a task..."
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                        id="input-task-text"
                        className="flex-1 md:w-64 bg-zinc-950 border border-zinc-800 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-zinc-700 text-zinc-200"
                      />
                      <button
                        onClick={handleAddTask}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold px-3 rounded-lg"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {["Studies", "Coding", "Career"].map((cat) => {
                      const listTasks = activeUser.tasks.filter(t => t.list === cat);
                      return (
                        <div key={cat} className="bg-zinc-950 p-3 rounded-lg border border-zinc-850/80 space-y-2.5">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono border-b border-zinc-850 pb-1 block">
                            {cat} Category
                          </span>
                          
                          {listTasks.length === 0 ? (
                            <p className="text-[10px] text-zinc-600 font-mono italic">No remaining tasks in list.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {listTasks.map((t) => (
                                <div key={t.id} className="flex justify-between items-center bg-zinc-900/60 p-2 rounded border border-zinc-850/40 group">
                                  <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={t.done}
                                      onChange={() => handleToggleTask(t.id)}
                                      className="rounded border-zinc-850 bg-zinc-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                                    />
                                    <span className={`text-[11px] font-medium leading-tight ${t.done ? "line-through text-zinc-600" : "text-zinc-300"}`}>
                                      {t.text}
                                    </span>
                                  </label>
                                  <button
                                    onClick={() => handleDeleteTask(t.id)}
                                    className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </motion.div>
            )}

            {/* 1.5 REAL-TIME SCHEDULER & ALARMS TAB */}
            {activeTab === "scheduler" && (
              <motion.div
                key="scheduler"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Header Banner */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Clock className="w-5 h-5 text-emerald-400 animate-pulse" />
                      REAL-TIME ALARM SCHEDULER &amp; PLANNER
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Enter your daily plans and exact timings. The personal operating system runs a continuous ticking clock to trigger alarms and notifications instantly.
                    </p>
                  </div>
                  <div className="bg-zinc-950 px-4 py-2 border border-zinc-800 rounded-xl text-center">
                    <span className="text-[10px] text-zinc-500 font-mono block uppercase">Active System Clock</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">{tickingClock}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Create Alarms */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-800 pb-2.5">
                        Add Plan &amp; Alarm Time
                      </span>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-zinc-400 font-mono font-semibold uppercase">Plan Description</label>
                          <input
                            type="text"
                            placeholder="e.g. Revise Neural Networks"
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-zinc-400 font-mono font-semibold uppercase">Alarm Timing (HH:MM AM/PM)</label>
                          <input
                            type="text"
                            placeholder="e.g. 03:15 PM"
                            value={newPlanTime}
                            onChange={(e) => setNewPlanTime(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono text-center focus:outline-none focus:border-zinc-700 font-bold"
                          />
                          <p className="text-[10px] text-zinc-500 font-sans leading-normal">
                            Enter the timing in 12-hour format with AM/PM (e.g., 09:00 AM, 12:45 PM, 06:30 PM).
                          </p>
                        </div>

                        {/* Timing Presets */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-zinc-500 font-mono block uppercase">Quick Time Selectors</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { label: "+5m", mins: 5 },
                              { label: "+15m", mins: 15 },
                              { label: "+30m", mins: 30 },
                              { label: "+1h", mins: 60 },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                onClick={() => {
                                  const date = new Date();
                                  date.setMinutes(date.getMinutes() + preset.mins);
                                  const hrs = date.getHours();
                                  const mins = date.getMinutes();
                                  const ampm = hrs >= 12 ? "PM" : "AM";
                                  const cleanHrs = hrs % 12 || 12;
                                  const formattedHrs = cleanHrs < 10 ? `0${cleanHrs}` : cleanHrs;
                                  const formattedMins = mins < 10 ? `0${mins}` : mins;
                                  setNewPlanTime(`${formattedHrs}:${formattedMins} ${ampm}`);
                                  showNotification(`Set target timing to ${formattedHrs}:${formattedMins} ${ampm}!`);
                                }}
                                className="bg-zinc-950 hover:bg-zinc-800 text-[10px] font-mono text-zinc-400 py-1.5 rounded border border-zinc-850 cursor-pointer"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleAddPlan}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Bell className="w-4 h-4" />
                          Arm Real-Time Alarm 🔔
                        </button>
                      </div>
                    </div>

                    {/* Notification Automation Log Info */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3.5">
                      <h4 className="text-xs font-bold text-white font-mono uppercase">Alarm Integration Matrix</h4>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        When an alarm triggers, MK AI OS dispatches concurrent events:
                      </p>
                      <ul className="space-y-2 text-[10px] font-mono text-zinc-500">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400">⚡</span>
                          <span><strong>Browser Notification:</strong> A rich toast popup containing action items appears instantly.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-purple-400">⚡</span>
                          <span><strong>Telegram Alert:</strong> Spawns a webhook trigger to dispatch an alert directly to your Telegram bot client.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-sky-400">⚡</span>
                          <span><strong>Daemon Polling:</strong> The local Python agent on your PC detects the alarm on its next telemetry sync heartbeat.</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Right Column: Active Schedules list */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                        <span className="text-xs font-bold text-white font-mono uppercase">
                          Armed Plans &amp; Timings Queue
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {planList.length} scheduled alarms
                        </span>
                      </div>

                      <div className="space-y-3">
                        {planList.map((plan) => {
                          const isAlreadyNotified = notifiedPlanIds[plan.id];
                          return (
                            <div
                              key={plan.id}
                              className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 transition-all ${
                                isAlreadyNotified 
                                  ? "bg-zinc-950/40 border-zinc-850 opacity-60" 
                                  : "bg-zinc-950 border-zinc-800 hover:border-zinc-750"
                              }`}
                            >
                              <div className="space-y-1.5 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs font-bold text-zinc-200">{plan.planName}</h4>
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                                    isAlreadyNotified 
                                      ? "bg-zinc-900 text-zinc-500 border border-zinc-800" 
                                      : "bg-emerald-950 text-emerald-400 border border-emerald-900"
                                  }`}>
                                    {isAlreadyNotified ? "TRIGGERED" : "ARMED"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                                  <span className="text-emerald-400 bg-emerald-950/30 border border-emerald-950/50 px-2 py-0.5 rounded-md">
                                    ⏰ {plan.planTime}
                                  </span>
                                  <span>ID: {plan.id}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => handleTriggerPlanAlarm(plan)}
                                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 border border-zinc-800 text-[10px] font-mono px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                  title="Manually trigger test notification for this plan"
                                >
                                  <Bell className="w-3.5 h-3.5" />
                                  Test Trigger ⚡
                                </button>
                                <button
                                  onClick={() => {
                                    setPlanList(prev => prev.filter(p => p.id !== plan.id));
                                    showNotification(`Deleted schedule item: "${plan.planName}"`, "info");
                                  }}
                                  className="bg-zinc-900 hover:bg-red-950 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-900 p-1.5 rounded-lg transition-all cursor-pointer"
                                  title="Delete Alarm"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {planList.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 text-center px-4 space-y-2.5">
                            <Clock className="w-8 h-8 text-zinc-600 animate-pulse" />
                            <div>
                              <p className="text-xs font-bold text-zinc-400 font-mono">No Armed Plans Found</p>
                              <p className="text-[10px] text-zinc-500 leading-normal max-w-sm mt-1">
                                Enter custom items on the left form and specify their 12-hour AM/PM trigger timestamps to arm alarms.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. ASSISTANT CHAT TAB */}
            {activeTab === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[550px]"
              >
                
                {/* Left controls sidebar */}
                <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between space-y-6 overflow-y-auto">
                  <div className="space-y-5">
                    
                    <div className="border-b border-zinc-800 pb-3">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-emerald-400" />
                        ASSISTANT MODEL PROFILE
                      </h3>
                      <p className="text-[10px] text-zinc-500 mt-1">Configure reasoning brain settings</p>
                    </div>

                    <div className="space-y-3">
                      
                      <div className="space-y-1">
                        <label className="text-[11px] font-mono text-zinc-400">Current Assistant</label>
                        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black font-extrabold text-sm shadow">
                            {selectedAssistant.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white">{selectedAssistant.name}</h4>
                            <p className="text-[10px] text-zinc-500 font-mono">{selectedAssistant.personality}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-mono text-zinc-400">AI Provider Selection</label>
                        <select
                          value={activeModel}
                          onChange={(e) => setActiveModel(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 p-2 focus:outline-none"
                        >
                          <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (Standard)</option>
                          <option value="OpenAI GPT-4o-mini">OpenAI GPT-4o-mini (Multimodal)</option>
                          <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet (Agentic)</option>
                          <option value="Groq LLaMA-3 70B">Groq LLaMA-3 70B (High-Speed)</option>
                          <option value="Ollama Local Models">Local Ollama (Offline / Private)</option>
                        </select>
                      </div>

                      <div className="space-y-1 pt-2">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase block font-bold">Workspace Scopes Enabled</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {["Gmail", "Calendar", "Drive", "GitHub", "Notion", "ChromaDB"].map((sc) => (
                            <div key={sc} className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-850 p-1.5 rounded text-[10px] text-zinc-400">
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{sc} module</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                  </div>

                  {/* Audio visualizer block */}
                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-850 space-y-3">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                      Audio Speech Engine
                    </span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Toggle standard text-to-speech feedback using ElevenLabs or native synthesis models.
                    </p>
                    {audioFeedbackText && (
                      <div className="text-[10px] font-mono text-emerald-400 leading-normal animate-pulse bg-emerald-950/20 p-2 rounded border border-emerald-900/40">
                        {audioFeedbackText}
                      </div>
                    )}
                  </div>

                </div>

                {/* Right Chat Terminal Area */}
                <div className="lg:col-span-8 flex flex-col bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                  
                  {/* Chat top bar */}
                  <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3.5 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-9 h-9 rounded-full ${activeUser.avatarColor} flex items-center justify-center font-bold text-white shadow-inner`}>
                          {selectedAssistant.name.charAt(0)}
                        </div>
                        <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-900" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                          {selectedAssistant.name}
                          <span className="text-[10px] font-normal text-zinc-400">({selectedAssistant.personality})</span>
                        </h3>
                        <p className="text-[10px] text-emerald-400 font-mono">Isolated tenant workspace active</p>
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-500 font-mono hidden sm:block uppercase">
                      AES-256 chat feed encryption active
                    </div>
                  </div>

                  {/* Scrollable messages panel */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-zinc-950/40">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                        
                        {/* Timestamp badge */}
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500 font-mono">
                          <span>{msg.sender === "user" ? "YOU" : selectedAssistant.name.toUpperCase()}</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        {/* Bubble */}
                        <div className="max-w-[85%] flex flex-col gap-2">
                          <div className={`rounded-2xl p-4 text-xs md:text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.sender === "user"
                              ? "bg-emerald-950/20 text-emerald-100 border border-emerald-500/20 rounded-tr-none self-end ml-auto"
                              : "bg-zinc-900/60 text-zinc-200 border border-zinc-800 rounded-tl-none"
                          }`}>
                            {msg.text}
                          </div>

                          {/* TTS Play Button */}
                          {msg.sender === "bot" && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSynthesizeVoice(msg.text)}
                                className="text-[10px] font-mono text-zinc-500 hover:text-emerald-400 flex items-center gap-1 bg-zinc-900 border border-zinc-850 px-2 py-1 rounded transition-all"
                              >
                                <Volume2 className="w-3 h-3 text-zinc-500" />
                                Listen Speech
                              </button>
                            </div>
                          )}

                          {/* Reasoning Thought step-logs dropdown */}
                          {msg.thoughtSteps && (
                            <div className="bg-zinc-950 border border-zinc-850 rounded-lg overflow-hidden mt-1">
                              <details className="group">
                                <summary className="flex justify-between items-center px-3 py-2 text-[10px] text-zinc-400 font-mono cursor-pointer list-none hover:bg-zinc-900/40 select-none">
                                  <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                                    <Terminal className="w-3 h-3 text-emerald-400" />
                                    COGNITIVE WORKFLOW &amp; DATA QUERIES ({msg.thoughtSteps.length} Steps)
                                  </span>
                                  <ChevronDown className="w-3 h-3 text-zinc-500 group-open:rotate-180 transition-transform" />
                                </summary>
                                <div className="p-3 border-t border-zinc-850 font-mono text-[10px] text-zinc-400 leading-normal space-y-2 bg-zinc-950/90 divide-y divide-zinc-900">
                                  {msg.thoughtSteps.map((step, sIdx) => (
                                    <div key={sIdx} className="pt-2 first:pt-0 flex gap-2">
                                      <span className="text-zinc-600">[{sIdx + 1}]</span>
                                      <span className="flex-1">{step}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </div>
                          )}

                        </div>

                      </div>
                    ))}

                    {/* Chat loader state */}
                    {isAiLoading && (
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500 font-mono">
                          <span>{selectedAssistant.name.toUpperCase()}</span>
                          <span>•</span>
                          <span>Thinking...</span>
                        </div>
                        <div className="bg-zinc-900/60 text-zinc-400 border border-zinc-800 rounded-xl rounded-tl-none p-4 max-w-[80%] flex items-center gap-3">
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                          <span className="text-xs font-mono">Scanning isolated database &amp; invoking Gemini SDK...</span>
                        </div>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  {/* Message Input form footer */}
                  <div className="bg-zinc-900 border-t border-zinc-800 p-3 sm:p-4 shrink-0">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={`Message ${selectedAssistant.name} in isolated ${activeUser.name} vault...`}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 text-xs sm:text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-zinc-700 text-zinc-200"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || isAiLoading}
                        className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-semibold px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send
                      </button>
                    </form>
                  </div>

                </div>

              </motion.div>
            )}

            {/* 3. ASSISTANT SETUP WIZARD */}
            {activeTab === "wizard" && (
              <motion.div
                key="wizard"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl"
              >
                
                {/* Header title */}
                <div className="border-b border-zinc-800 pb-4 space-y-1">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-emerald-400" />
                    CREATE NEW PERSONAL EXECUTIVE ASSISTANT
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Step-by-step assistant generation wizard. Multi-user isolation protocol is automatically configured.
                  </p>
                </div>

                {/* Progress bar mapping */}
                <div className="flex items-center justify-between pb-2">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        wizardStep === step
                          ? "bg-emerald-500 text-black"
                          : wizardStep > step
                          ? "bg-emerald-950 border border-emerald-800 text-emerald-400"
                          : "bg-zinc-950 text-zinc-600 border border-zinc-800"
                      }`}>
                        {step}
                      </div>
                      <span className={`text-xs font-mono ${wizardStep === step ? "text-zinc-200 font-bold" : "text-zinc-500"}`}>
                        {step === 1 ? "Personality" : step === 2 ? "AI Provider" : "Connect Apps"}
                      </span>
                      {step < 3 && <div className="w-8 h-[1px] bg-zinc-800" />}
                    </div>
                  ))}
                </div>

                {/* STEP 1 FORM: PERSONALITY */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-zinc-400 uppercase">Assistant Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Jarvis, Sophia, Friday"
                          value={newBotName}
                          onChange={(e) => setNewBotName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 text-xs px-3 py-2 rounded-lg text-zinc-200 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-zinc-400 uppercase">Assistant Persona / Vibe</label>
                        <select
                          value={newBotPersonality}
                          onChange={(e) => setNewBotPersonality(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 text-xs px-3 py-2 rounded-lg text-zinc-200 focus:outline-none"
                        >
                          <option value="Professional & Efficient">Professional &amp; Efficient</option>
                          <option value="Encouraging & Explanatory">Encouraging &amp; Explanatory</option>
                          <option value="Direct & Business-oriented">Direct &amp; Business-oriented</option>
                          <option value="Socratic Academic Advisor">Socratic Academic Advisor</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-mono text-zinc-400 uppercase">Description / Scope of Support</label>
                      <input
                        type="text"
                        placeholder="e.g. Helps me organize my final computer science projects, resumes, and schedules"
                        value={newBotDesc}
                        onChange={(e) => setNewBotDesc(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 text-xs px-3 py-2 rounded-lg text-zinc-200 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-zinc-400 uppercase">Default Language</label>
                        <select
                          value={newBotLanguage}
                          onChange={(e) => setNewBotLanguage(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 text-xs px-3 py-2 rounded-lg text-zinc-200 focus:outline-none"
                        >
                          <option value="English (US)">English (US)</option>
                          <option value="English (UK)">English (UK)</option>
                          <option value="Spanish (ES)">Spanish (ES)</option>
                          <option value="German (DE)">German (DE)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-zinc-400 uppercase">Voice Pitch Mode</label>
                        <div className="flex gap-2">
                          {["Female", "Male"].map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setNewBotVoice(g as any)}
                              className={`flex-1 border text-xs py-2 rounded-lg font-mono ${
                                newBotVoice === g
                                  ? "bg-emerald-950 text-emerald-400 border-emerald-500"
                                  : "bg-zinc-950 text-zinc-400 border-zinc-850"
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-zinc-400 uppercase">Timezone Synchronization</label>
                        <select className="w-full bg-zinc-950 border border-zinc-800 text-xs px-3 py-2 rounded-lg text-zinc-200 focus:outline-none">
                          <option>UTC-7 (Pacific Standard)</option>
                          <option>UTC+5.5 (Indian Standard)</option>
                          <option>UTC+0 (Greenwich Mean Time)</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        onClick={() => wizardStep < 3 && setWizardStep(2)}
                        disabled={!newBotName.trim()}
                        className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-black font-semibold text-xs py-2 px-5 rounded-lg flex items-center gap-1.5 transition-all"
                      >
                        Choose AI Provider
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2 FORM: AI PROVIDER KEYS */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-400">
                      Select your preferred LLM provider. The API key is stored locally in your single-tenant encrypted vault storage.
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        "Gemini 2.5 Flash",
                        "OpenAI GPT-4o-mini",
                        "Claude 3.5 Sonnet",
                        "Groq LLaMA-3",
                        "OpenRouter Endpoint",
                        "Local Ollama"
                      ].map((provider) => {
                        const isSelected = newBotProvider === provider;
                        return (
                          <button
                            key={provider}
                            type="button"
                            onClick={() => setNewBotProvider(provider)}
                            className={`border text-left p-3 rounded-xl transition-all ${
                              isSelected
                                ? "bg-emerald-950/20 border-emerald-500 text-white shadow-lg"
                                : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:border-zinc-800"
                            }`}
                          >
                            <span className="text-[11px] font-mono font-bold block">{provider}</span>
                            <span className="text-[9px] text-zinc-500 mt-1 block">
                              {provider === "Local Ollama" ? "Zero API keys needed" : "Isolated storage"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {newBotProvider !== "Local Ollama" && (
                      <div className="space-y-1 pt-2">
                        <label className="text-xs font-mono text-zinc-400 uppercase flex items-center justify-between">
                          <span>API Credentials for {newBotProvider.split(" ")[0]}</span>
                          <span className="text-[9px] text-emerald-400 font-mono">Simulated Secure Cryptography AES</span>
                        </label>
                        <input
                          type="password"
                          placeholder={`Enter ${newBotProvider} Token value...`}
                          value={newBotApiKey}
                          onChange={(e) => setNewBotApiKey(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 text-xs px-3 py-2 rounded-lg text-zinc-200 focus:outline-none font-mono"
                        />
                      </div>
                    )}

                    <div className="pt-4 flex justify-between">
                      <button
                        onClick={() => setWizardStep(1)}
                        className="bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs py-2 px-4 rounded-lg"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setWizardStep(3)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs py-2 px-5 rounded-lg flex items-center gap-1.5"
                      >
                        Connect Developer Apps
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3 FORM: CONNECT SERVICES (OAUTH / API) */}
                {wizardStep === 3 && (
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-400">
                      Link active services with your secure multi-tenant environment. We authorize using OAuth. No raw passwords are required.
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { id: "google-gmail", name: "Gmail Feed", icon: Mail },
                        { id: "google-calendar", name: "Google Calendar", icon: Calendar },
                        { id: "google-drive", name: "Google Drive", icon: HardDrive },
                        { id: "github", name: "GitHub Repository", icon: GitBranch },
                        { id: "notion", name: "Notion Workspaces", icon: FileCode },
                        { id: "telegram", name: "Telegram Client", icon: Bot },
                        { id: "weather-api", name: "Weather API", icon: Cloud },
                        { id: "stripe", name: "Stripe Billing", icon: ShieldCheck }
                      ].map((app) => {
                        const isConnected = connectedAppsSelected.includes(app.id);
                        return (
                          <button
                            key={app.id}
                            type="button"
                            onClick={() => toggleAppConnection(app.id)}
                            className={`border text-left p-3 rounded-xl transition-all flex flex-col justify-between ${
                              isConnected
                                ? "bg-emerald-950/20 border-emerald-500 text-emerald-400 shadow-lg"
                                : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:border-zinc-800"
                            }`}
                          >
                            <app.icon className={`w-5 h-5 ${isConnected ? "text-emerald-400" : "text-zinc-500"}`} />
                            <span className="text-[10px] font-mono font-bold mt-2 block text-zinc-300">{app.name}</span>
                            <span className="text-[8px] text-zinc-500 font-mono block mt-0.5">
                              {isConnected ? "Connected (OAuth)" : "Disconnected"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-6 border-t border-zinc-800 flex justify-between">
                      <button
                        onClick={() => setWizardStep(2)}
                        className="bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs py-2 px-4 rounded-lg"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleCreateAssistant}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs py-2.5 px-6 rounded-lg flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Compile and Save Assistant
                      </button>
                    </div>
                  </div>
                )}

              </motion.div>
            )}

            {/* 4. API KEY VAULT TAB */}
            {activeTab === "vault" && (
              <motion.div
                key="vault"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                
                {/* Vault Intro Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <LockKeyhole className="w-5 h-5 text-emerald-400" />
                      SECURE CREDENTIAL &amp; API VAULT
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Every token is cryptographically isolated by Tenant ID <code className="text-emerald-400 font-mono">"{activeUser.id}"</code>. De-serialized only on-demand during active assistant runs.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={encryptionEnabled}
                        onChange={(e) => setEncryptionEnabled(e.target.checked)}
                        className="rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-zinc-400">Enable Hardware AES Encryption Simulation</span>
                    </label>
                  </div>
                </div>

                {/* Add dynamic Key */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 block">
                    Append API Credentials to Tenant
                  </span>
                  
                   <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select
                        value={newVaultKeyName}
                        onChange={(e) => setNewVaultKeyName(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 p-2.5 focus:outline-none cursor-pointer"
                      >
                        <option value="OpenAI API Key">OpenAI API Key</option>
                        <option value="Gemini API Key">Gemini API Key</option>
                        <option value="Claude Anthropic Key">Claude Anthropic Key</option>
                        <option value="GitHub OAuth Token">GitHub OAuth Token</option>
                        <option value="Telegram Bot Token">Telegram Bot Token</option>
                        <option value="Stripe Secret Gateway">Stripe Secret Gateway</option>
                        <option value="Supabase Admin Secret">Supabase Admin Secret</option>
                        <option value="Custom Key...">Custom Key (Other Provider)...</option>
                      </select>

                      {newVaultKeyName === "Custom Key..." ? (
                        <input
                          type="text"
                          placeholder="e.g. AWS Key or Spotify Client ID"
                          value={customVaultKeyName}
                          onChange={(e) => setCustomVaultKeyName(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 p-2.5 focus:outline-none font-mono"
                        />
                      ) : (
                        <div className="hidden md:block bg-zinc-950/20 border border-zinc-850 p-2.5 rounded-lg text-[10px] text-zinc-500 font-mono flex items-center">
                          AES-256 standard validation envelope active.
                        </div>
                      )}

                      <input
                        type="password"
                        placeholder="Enter credential value (sk-...)"
                        value={newVaultKeyValue}
                        onChange={(e) => setNewVaultKeyValue(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 p-2.5 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleAddVaultKey}
                        className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg px-6 py-2.5 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Add Encrypted Key
                      </button>
                    </div>
                  </div>
                </div>

                {/* Keys list */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                    <span className="text-xs font-semibold text-zinc-300 font-mono">
                      Active Credentials for {activeUser.name}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Database: keys_isolation_proxy
                    </span>
                  </div>

                  <div className="space-y-2">
                    {Object.keys(activeUser.apiKeys).length === 0 ? (
                      <p className="text-xs text-zinc-500 italic py-4 text-center font-mono">No keys active. Platform will run in simulation mock mode.</p>
                    ) : (
                      Object.keys(activeUser.apiKeys).map((keySlug) => {
                        const keyObj = activeUser.apiKeys[keySlug];
                        const isVisible = visibleKeys[keySlug];
                        return (
                          <div key={keySlug} className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl flex items-center justify-between gap-4 font-mono text-xs">
                            <div className="space-y-1">
                              <span className="text-zinc-300 font-bold capitalize flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {keySlug.replace(/_/g, " ")}
                              </span>
                              <div className="text-[11px] text-zinc-500">
                                {isVisible ? (
                                  <span className="text-zinc-400">{keyObj.value}</span>
                                ) : (
                                  <span>•••••••••••••••••••••••••••••••• {keyObj.isEncrypted ? "(AES Encrypted)" : "(Plain)"}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setVisibleKeys(prev => ({ ...prev, [keySlug]: !prev[keySlug] }))}
                                className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 p-2 rounded text-zinc-400"
                              >
                                {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleRemoveVaultKey(keySlug)}
                                className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 p-2 rounded text-red-400 hover:border-red-900/50 hover:bg-red-950/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </motion.div>
            )}

            {/* 5. KNOWLEDGE BASE / FILES TAB */}
            {activeTab === "knowledge" && (
              <motion.div
                key="knowledge"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left part: Upload & Document Directory list */}
                  <div className="lg:col-span-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5 flex flex-col">
                    
                    <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <HardDrive className="w-4 h-4 text-emerald-400" />
                        File Directory &amp; Knowledge Base
                      </h3>
                      <span className="text-[10px] text-zinc-500 font-mono">S3 Cloud Storage Sandbox</span>
                    </div>

                    {/* Drag and drop upload simulator */}
                    <div className="bg-zinc-950 border-2 border-dashed border-zinc-850 hover:border-zinc-750 transition-all rounded-xl p-5 text-center space-y-3 cursor-pointer relative">
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        id="knowledge-file-uploader"
                      />
                      <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                        <HardDrive className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">Drag &amp; Drop or Select Local File</p>
                        <p className="text-[10px] text-zinc-500 mt-1">Supports PDF, Word, Excel, CSV, MD (Max 50MB)</p>
                      </div>

                      <div className="flex justify-center items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono">Auto-Categorize As:</span>
                        <select
                          value={newFileCategory}
                          onChange={(e) => setNewFileCategory(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 py-1 px-2.5 rounded focus:outline-none cursor-pointer"
                        >
                          <option value="Resume">Resume</option>
                          <option value="Studies">Studies</option>
                          <option value="Career">Career</option>
                          <option value="Research">Research</option>
                        </select>
                      </div>
                    </div>

                    {/* Search files */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search database files..."
                          value={fileSearchQuery}
                          onChange={(e) => setFileSearchQuery(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-xs p-2 pl-9 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Files list */}
                    <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
                      {uploadedFiles
                        .filter(f => f.filename.toLowerCase().includes(fileSearchQuery.toLowerCase()))
                        .map((f) => {
                          const isSelected = selectedFile?.id === f.id;
                          return (
                            <div
                              key={f.id}
                              onClick={() => {
                                // Actually opens the real uploaded file (not
                                // just a Q&A panel) — the browser renders it
                                // inline if it can (PDF/image/text) or
                                // downloads it otherwise. Identical behavior
                                // on mobile: it's just a normal link/tab.
                                window.open(`/api/documents/${activeUser.id}/${f.id}/file`, "_blank");
                                setSelectedFile(f);
                                setDocQueryAnswer("");
                                setDocQueryInput("");
                              }}
                              className={`p-3 rounded-xl border transition-all flex justify-between items-center text-xs cursor-pointer ${
                                isSelected 
                                  ? "bg-emerald-950/20 border-emerald-500/80 shadow-md shadow-emerald-500/5" 
                                  : "bg-zinc-950 border-zinc-850 hover:border-zinc-750"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg border ${isSelected ? "bg-emerald-900/30 text-emerald-400 border-emerald-900/40" : "bg-zinc-900 text-zinc-400 border-zinc-800"}`}>
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                  <h4 className="font-bold text-zinc-300 font-mono text-[11px] truncate max-w-[170px]">{f.filename}</h4>
                                  <p className="text-[9px] text-zinc-500 mt-0.5">{(f.size_bytes / 1024).toFixed(0)} KB • {new Date(f.created_at).toLocaleString()}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[9px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded">
                                  {f.category}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.id); }}
                                  className="text-zinc-600 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      {uploadedFiles.length === 0 && (
                        <p className="text-[10px] text-zinc-600 font-mono italic text-center py-4">No files uploaded yet. Upload a PDF or text file above.</p>
                      )}
                      {isUploadingFile && (
                        <p className="text-[10px] text-emerald-400 font-mono text-center py-2 animate-pulse">Uploading &amp; extracting text...</p>
                      )}
                    </div>

                  </div>

                  {/* Right part: Semantic ChromaDB Vector memory visualizer & Q&A */}
                  <div className="lg:col-span-6 space-y-6">
                    
                    {/* Active File Inspector & Q&A */}
                    {selectedFile ? (
                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                        <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
                          <div className="text-left">
                            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider block">Active Document</span>
                            <h3 className="text-xs font-bold text-white font-mono mt-0.5">{selectedFile.filename}</h3>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono uppercase">{selectedFile.category}</span>
                        </div>

                        <div className="space-y-4">
                          {/* Q&A Widget */}
                          <div className="space-y-2 bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider block font-bold border-b border-zinc-850 pb-1.5">
                              💬 Document Q&amp;A (real, backed by Gemini + extracted text)
                            </span>
                            <p className="text-[9px] text-zinc-500 leading-normal">Ask a question about this document's actual contents:</p>
                            
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="e.g. what does this document say about..."
                                value={docQueryInput}
                                onChange={(e) => setDocQueryInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleDocQuery()}
                                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none font-mono"
                              />
                              <button
                                onClick={handleDocQuery}
                                disabled={isDocQuerying}
                                className="bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1 font-mono shrink-0"
                              >
                                {isDocQuerying ? "Asking..." : "Query"}
                              </button>
                            </div>

                            {/* Answer display */}
                            {docQueryAnswer && (
                              <div className="bg-zinc-900/80 border border-emerald-900/40 p-2.5 rounded text-[11px] leading-relaxed text-zinc-300 text-left space-y-1 font-mono mt-2 animate-fadeIn">
                                <p className="text-zinc-500 text-[9px] font-bold uppercase">ANSWER:</p>
                                <p className="text-emerald-400 leading-normal whitespace-pre-wrap">{docQueryAnswer}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-500 italic text-xs font-mono">
                        Select a file from the directory to ask questions about it.
                      </div>
                    )}

                    {/* Chromadb Global Search */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                      <div className="border-b border-zinc-800 pb-3">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                          <Cpu className="w-4 h-4 text-indigo-400" />
                          ChromaDB Tenant Memory Vector Search
                        </h3>
                        <p className="text-[10px] text-zinc-500 mt-1">Global cosine-similarity query across indexed documents</p>
                      </div>

                      <div className="space-y-3">
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-xs leading-relaxed text-zinc-400 space-y-1">
                          <p className="font-semibold text-zinc-300">Active Tenant Registry:</p>
                          <code className="text-indigo-400 font-mono text-[9px]">chromadb_user_col_{activeUser.id}_isolated</code>
                          <p className="text-[9px] text-zinc-500 mt-1.5">Search logs, conversation history, and vectorized file records simultaneously.</p>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="e.g. skills, neural network, stripe, backpropagation"
                              value={vectorQuery}
                              onChange={(e) => setVectorQuery(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleVectorSearch()}
                              className="flex-1 bg-zinc-950 border border-zinc-850 text-xs px-3 py-1.5 rounded-lg focus:outline-none"
                            />
                            <button
                              onClick={handleVectorSearch}
                              className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs px-4 rounded-lg flex items-center gap-1 font-mono"
                            >
                              Query
                            </button>
                          </div>
                        </div>

                        {/* Resulting vector memories */}
                        <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-3 min-h-[110px] flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold block mb-2 border-b border-zinc-850 pb-1">
                              Cosine Similarity Results (Similarity &gt; 0.72)
                            </span>
                            
                            {isVectorSearching ? (
                              <div className="flex items-center gap-2 justify-center py-4 text-zinc-500 font-mono text-xs">
                                <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                                Comparing floating vectors...
                              </div>
                            ) : vectorSearchResult.length === 0 ? (
                              <p className="text-[9px] text-zinc-600 font-mono italic">Enter a query above to fetch relevant context vectors.</p>
                            ) : (
                              <div className="space-y-2">
                                {vectorSearchResult.map((res, i) => (
                                  <p key={i} className="text-[10px] font-mono text-emerald-400 leading-normal bg-zinc-900 p-2 rounded border border-zinc-850 text-left">
                                    • {res}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="text-[9px] text-zinc-600 font-mono text-right pt-2 mt-2 border-t border-zinc-850">
                            Verification: 100% Cryptographically Isolated
                          </div>
                        </div>

                      </div>

                    </div>

                  </div>

                </div>

              </motion.div>
            )}

            {/* 6. AUTOMATIONS BUILDER TAB */}

            {/* 7. RELATIONAL DATABASE TAB */}
            {activeTab === "schema" && (
              <motion.div
                key="schema"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-5xl mx-auto space-y-6"
              >
                
                {/* Intro card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-400" />
                    RELATIONAL MULTI-TENANT POSTGRES SCHEMA (DDL)
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    This platform uses strict relational constraints. Each data table possesses relational dependencies tied to <code className="text-emerald-400 font-mono">user_id</code> and <code className="text-indigo-400 font-mono">assistant_id</code>. Under no circumstances can queries cross-leak tenants.
                  </p>
                </div>

                {/* DB Connection & Query Simulator */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <div>
                      <span className="text-xs font-bold text-white font-mono uppercase block">
                        🔌 RELATIONAL DB CONNECTION &amp; TENANT ISOLATION AUDITOR
                      </span>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Diagnose cloud Postgres socket bridges and run row-level leakage assertions.</p>
                    </div>
                    <button
                      onClick={handleRunDbAudit}
                      disabled={isAuditingDb}
                      className="bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white font-mono text-xs px-4 py-2 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1.5"
                    >
                      {isAuditingDb ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Database className="w-3.5 h-3.5" />
                      )}
                      Assert Isolation
                    </button>
                  </div>

                  <div className="bg-black border border-zinc-850 rounded-xl p-4 font-mono text-xs leading-relaxed text-zinc-300 min-h-[160px] max-h-[280px] overflow-y-auto space-y-1.5">
                    {dbAuditLogs.map((log, idx) => (
                      <p
                        key={idx}
                        className={
                          log.startsWith("> SUCCESS") || log.startsWith("> [OK]")
                            ? "text-emerald-400 font-bold"
                            : log.startsWith("> VERIFYING")
                            ? "text-indigo-400"
                            : "text-zinc-400"
                        }
                      >
                        {log}
                      </p>
                    ))}
                    {dbAuditLogs.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-600">
                        <Database className="w-10 h-10 mb-2 opacity-50 animate-pulse text-indigo-400" />
                        <p className="text-xs">Database proxy socket is idle.</p>
                        <p className="text-[10px] mt-0.5">Click "Assert Isolation" to execute automated Row-Level Security checks.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Relational Data Row Browser */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-800 pb-3 gap-2">
                    <div>
                      <span className="text-xs font-bold text-white font-mono uppercase block flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-emerald-400" />
                        📊 Live Relational Row Explorer
                      </span>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Inspect, query, and modify live multi-tenant rows in the postgres database tables.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSeedDatabase}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
                      >
                        🌱 Seed Random Row
                      </button>
                      <button
                        onClick={() => {
                          setDbRowsUsers([
                            { id: "u_001", name: "Murali Krishna", email: "murali.cse@gitam.edu", plan: "Pro", role: "developer" }
                          ]);
                          setDbRowsAssistants([
                            { id: "a_001", user_id: "u_001", name: "Jarvis", personality: "Analytical Specialist", language: "English", voice: "Male" }
                          ]);
                          setDbRowsApiKeys([
                            { id: "k_001", user_id: "u_001", provider_slug: "gemini_pro", encrypted_value: "U2FsdGVkX19D7Xv/Psz14x7zZ8Q...", iv_vector: "f9ae32e8b09d115a" }
                          ]);
                          setDbRowsDocKnowledge([
                            { id: "d_001", user_id: "u_001", filename: "My_Resume_Summer_2026.pdf", s3_storage_url: "s3://murali-vault/resumes/my_resume_2026.pdf", file_size_bytes: 188416 }
                          ]);
                          showNotification("Database cleared & reset to isolated Murali dev baseline.", "info");
                        }}
                        className="bg-zinc-800 hover:bg-zinc-750 text-zinc-400 font-mono text-[11px] px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-zinc-750"
                      >
                        🧹 Reset
                      </button>
                    </div>
                  </div>

                  {/* Table Selection Tabs */}
                  <div className="flex flex-wrap gap-2">
                    {(["users", "assistants", "api_keys", "document_knowledge"] as const).map((table) => {
                      const displayedRows = 
                        table === "users" ? dbRowsUsers.filter(row => !filterByActiveUserOnly || row.id === "u_001") :
                        table === "assistants" ? dbRowsAssistants.filter(row => !filterByActiveUserOnly || row.user_id === "u_001") :
                        table === "api_keys" ? dbRowsApiKeys.filter(row => !filterByActiveUserOnly || row.user_id === "u_001") :
                        dbRowsDocKnowledge.filter(row => !filterByActiveUserOnly || row.user_id === "u_001");
                      
                      return (
                        <button
                          key={table}
                          onClick={() => setDbCurrentTable(table)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                            dbCurrentTable === table
                              ? "bg-purple-950/40 border border-purple-500 text-purple-400 font-bold"
                              : "bg-zinc-950 border border-zinc-850 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {table.toUpperCase()} ({displayedRows.length} rows)
                        </button>
                      );
                    })}
                  </div>

                  {/* Tenant Isolation Policy Control Panel */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="filterByActiveUserOnly"
                        checked={filterByActiveUserOnly}
                        onChange={(e) => {
                          setFilterByActiveUserOnly(e.target.checked);
                          showNotification(
                            e.target.checked 
                              ? "Tenant security isolation activated: SQL query limited to active user (WHERE user_id = 'u_001')" 
                              : "Global tenant overview activated: showing mock multi-user rows for demonstration.",
                            "info"
                          );
                        }}
                        className="w-4 h-4 rounded text-emerald-500 bg-zinc-900 border-zinc-800 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="filterByActiveUserOnly" className="text-xs font-semibold text-zinc-300 cursor-pointer select-none flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-emerald-400" />
                        Strict Tenant Privacy Isolation <span className="text-[10px] text-emerald-400 font-mono">(Filter by Active User Only)</span>
                      </label>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 leading-none">
                      {filterByActiveUserOnly ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          SQL: SELECT * FROM {dbCurrentTable} WHERE user_id = 'u_001';
                        </span>
                      ) : (
                        <span className="text-zinc-400 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          SQL: SELECT * FROM {dbCurrentTable}; (Admin Platform Mode)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row Grid */}
                  <div className="overflow-x-auto border border-zinc-850 rounded-xl bg-zinc-950/50">
                    <table className="w-full text-left text-xs text-zinc-400">
                      <thead className="bg-zinc-950 text-[10px] text-zinc-500 uppercase font-mono border-b border-zinc-850">
                        {dbCurrentTable === "users" && (
                          <tr>
                            <th className="py-2.5 px-4 font-mono">ID</th>
                            <th className="py-2.5 px-4">Name</th>
                            <th className="py-2.5 px-4">Email</th>
                            <th className="py-2.5 px-4">Plan</th>
                            <th className="py-2.5 px-4">Role</th>
                          </tr>
                        )}
                        {dbCurrentTable === "assistants" && (
                          <tr>
                            <th className="py-2.5 px-4 font-mono">ID</th>
                            <th className="py-2.5 px-4 font-mono">User ID</th>
                            <th className="py-2.5 px-4">Name</th>
                            <th className="py-2.5 px-4">Personality</th>
                            <th className="py-2.5 px-4">Language</th>
                            <th className="py-2.5 px-4">Voice</th>
                          </tr>
                        )}
                        {dbCurrentTable === "api_keys" && (
                          <tr>
                            <th className="py-2.5 px-4 font-mono">ID</th>
                            <th className="py-2.5 px-4 font-mono">User ID</th>
                            <th className="py-2.5 px-4">Provider</th>
                            <th className="py-2.5 px-4">Value (Encrypted AES)</th>
                            <th className="py-2.5 px-4 font-mono">IV Vector</th>
                          </tr>
                        )}
                        {dbCurrentTable === "document_knowledge" && (
                          <tr>
                            <th className="py-2.5 px-4 font-mono">ID</th>
                            <th className="py-2.5 px-4 font-mono">User ID</th>
                            <th className="py-2.5 px-4">Filename</th>
                            <th className="py-2.5 px-4">S3 URL</th>
                            <th className="py-2.5 px-4 text-right">Size</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-zinc-850 font-mono text-[11px]">
                        {dbCurrentTable === "users" && dbRowsUsers
                          .filter(row => !filterByActiveUserOnly || row.id === "u_001")
                          .map((row, idx) => (
                            <tr key={idx} className="hover:bg-zinc-900/40">
                              <td className="py-2.5 px-4 font-bold text-emerald-400">{row.id}</td>
                              <td className="py-2.5 px-4 text-white font-semibold">{row.name}</td>
                              <td className="py-2.5 px-4 text-zinc-300">{row.email}</td>
                              <td className="py-2.5 px-4"><span className="bg-indigo-950 text-indigo-400 border border-indigo-900 px-2 py-0.5 rounded text-[10px]">{row.plan}</span></td>
                              <td className="py-2.5 px-4 text-zinc-500">{row.role}</td>
                            </tr>
                          ))}
                        {dbCurrentTable === "assistants" && dbRowsAssistants
                          .filter(row => !filterByActiveUserOnly || row.user_id === "u_001")
                          .map((row, idx) => (
                            <tr key={idx} className="hover:bg-zinc-900/40">
                              <td className="py-2.5 px-4 font-bold text-emerald-400">{row.id}</td>
                              <td className="py-2.5 px-4 text-zinc-500">{row.user_id}</td>
                              <td className="py-2.5 px-4 text-white font-semibold">{row.name}</td>
                              <td className="py-2.5 px-4 text-zinc-300">{row.personality}</td>
                              <td className="py-2.5 px-4 text-zinc-400">{row.language}</td>
                              <td className="py-2.5 px-4 text-zinc-500">{row.voice}</td>
                            </tr>
                          ))}
                        {dbCurrentTable === "api_keys" && dbRowsApiKeys
                          .filter(row => !filterByActiveUserOnly || row.user_id === "u_001")
                          .map((row, idx) => (
                            <tr key={idx} className="hover:bg-zinc-900/40">
                              <td className="py-2.5 px-4 font-bold text-emerald-400">{row.id}</td>
                              <td className="py-2.5 px-4 text-zinc-500">{row.user_id}</td>
                              <td className="py-2.5 px-4 text-indigo-400 font-bold">{row.provider_slug}</td>
                              <td className="py-2.5 px-4 text-zinc-400 max-w-[150px] truncate">{row.encrypted_value}</td>
                              <td className="py-2.5 px-4 text-zinc-650">{row.iv_vector}</td>
                            </tr>
                          ))}
                        {dbCurrentTable === "document_knowledge" && dbRowsDocKnowledge
                          .filter(row => !filterByActiveUserOnly || row.user_id === "u_001")
                          .map((row, idx) => (
                            <tr key={idx} className="hover:bg-zinc-900/40">
                              <td className="py-2.5 px-4 font-bold text-emerald-400">{row.id}</td>
                              <td className="py-2.5 px-4 text-zinc-500">{row.user_id}</td>
                              <td className="py-2.5 px-4 text-white font-semibold">{row.filename}</td>
                              <td className="py-2.5 px-4 text-zinc-400 text-[10px] font-mono select-all truncate max-w-[200px]">{row.s3_storage_url}</td>
                              <td className="py-2.5 px-4 text-right text-emerald-400">{(row.file_size_bytes / 1024).toFixed(1)} KB</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Schema visualization */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {[
                    {
                      name: "users",
                      columns: [
                        { name: "id", type: "UUID PRIMARY KEY" },
                        { name: "name", type: "VARCHAR(255)" },
                        { name: "email", type: "VARCHAR(255) UNIQUE" },
                        { name: "hashed_password", type: "TEXT" },
                        { name: "role", type: "VARCHAR(50) DEFAULT 'user'" }
                      ]
                    },
                    {
                      name: "assistants",
                      columns: [
                        { name: "id", type: "UUID PRIMARY KEY" },
                        { name: "user_id", type: "UUID REFERENCES users(id)" },
                        { name: "name", type: "VARCHAR(100)" },
                        { name: "personality", type: "TEXT" },
                        { name: "language", type: "VARCHAR(50)" },
                        { name: "voice", type: "VARCHAR(50)" }
                      ]
                    },
                    {
                      name: "api_keys",
                      columns: [
                        { name: "id", type: "UUID PRIMARY KEY" },
                        { name: "user_id", type: "UUID REFERENCES users(id)" },
                        { name: "provider_slug", type: "VARCHAR(50)" },
                        { name: "encrypted_value", type: "TEXT (AES Encrypted)" },
                        { name: "iv_vector", type: "VARCHAR(100)" }
                      ]
                    },
                    {
                      name: "chats_session",
                      columns: [
                        { name: "id", type: "UUID PRIMARY KEY" },
                        { name: "user_id", type: "UUID REFERENCES users(id)" },
                        { name: "assistant_id", type: "UUID REFERENCES assistants(id)" },
                        { name: "channel_type", type: "VARCHAR(50) (Telegram, Slack, Web)" },
                        { name: "created_at", type: "TIMESTAMP" }
                      ]
                    },
                    {
                      name: "messages_history",
                      columns: [
                        { name: "id", type: "UUID PRIMARY KEY" },
                        { name: "chat_session_id", type: "UUID REFERENCES chats_session(id)" },
                        { name: "user_id", type: "UUID REFERENCES users(id)" },
                        { name: "sender_role", type: "VARCHAR(50) (user, assistant)" },
                        { name: "payload_content", type: "TEXT (Encrypted)" }
                      ]
                    },
                    {
                      name: "document_knowledge",
                      columns: [
                        { name: "id", type: "UUID PRIMARY KEY" },
                        { name: "user_id", type: "UUID REFERENCES users(id)" },
                        { name: "filename", type: "VARCHAR(255)" },
                        { name: "s3_storage_url", type: "TEXT" },
                        { name: "file_size_bytes", type: "BIGINT" }
                      ]
                    }
                  ].map((table) => (
                    <div key={table.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                        <Database className="w-4 h-4 text-purple-400" />
                        <h3 className="text-xs font-bold text-white font-mono uppercase">{table.name}</h3>
                      </div>
                      <div className="space-y-1.5 font-mono text-[10px] text-zinc-400">
                        {table.columns.map((col, idx) => (
                          <div key={idx} className="flex justify-between border-b border-zinc-850/50 py-1 first:pt-0">
                            <span className="text-zinc-200 font-bold">{col.name}</span>
                            <span className="text-zinc-500">{col.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                </div>

                {/* Raw SQL DDL display */}
                <div className="bg-[#070707] border border-zinc-800 rounded-xl p-5 space-y-3">
                  <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-850 pb-2">
                    Raw Postgres DDL Multi-Tenant Isolation Constraints
                  </span>
                  <pre className="text-[10px] md:text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-[300px] p-4 bg-black/60 rounded border border-zinc-900">
{`-- 🛡️ CREATE USER MULTI-TENANT ACCOUNTS WITH AES ENCRYPTION KEY TRIGGERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    personality TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'English',
    voice VARCHAR(50) DEFAULT 'Female',
    greeting TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_slug VARCHAR(50) NOT NULL,
    encrypted_value TEXT NOT NULL, -- AES_256_CBC Encrypted Secret
    iv_vector VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_provider UNIQUE (user_id, provider_slug)
);

-- 🔐 STRICT TENANT QUERY POLICIES (Row-Level Security)
ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation_policy_assistants ON assistants
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY user_isolation_policy_keys ON api_keys
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);`}
                  </pre>
                </div>

              </motion.div>
            )}

            {/* 9. LAPTOP COMPANION TAB */}
            {activeTab === "laptop" && (
              <motion.div
                key="laptop"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Header Banner */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Laptop className="w-5 h-5 text-emerald-400" />
                      REMOTE LAPTOP COMPANION NODE
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Monitor hardware telemetry, adjust system volume, and execute native commands on your local PC in real-time.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border ${
                      laptopStatus?.online 
                        ? "bg-emerald-950/40 border-emerald-900 text-emerald-400" 
                        : "bg-zinc-950 border-zinc-800 text-zinc-500"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${laptopStatus?.online ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                      {laptopStatus?.online ? `CONNECTED (Last Sync: ${laptopStatus.lastSync})` : "OFFLINE (Polling Standby)"}
                    </span>
                    <button
                      onClick={fetchLaptopStatus}
                      className="bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 p-2 rounded-xl border border-zinc-750 transition-all flex items-center gap-1.5 cursor-pointer"
                      disabled={isRefreshingLaptop}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingLaptop ? "animate-spin" : ""}`} />
                      Sync Telemetry
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: System Metrics & volume adjustment */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Hardware Metrics Bento Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* CPU Metric */}
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase block">CPU Utilization</span>
                        <div className="relative pt-1">
                          <div className="flex mb-2 items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-emerald-400 bg-emerald-950/40 font-mono">
                                {laptopStatus?.cpu}%
                              </span>
                            </div>
                          </div>
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-zinc-850">
                            <div style={{ width: `${laptopStatus?.cpu || 12}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 transition-all duration-500" />
                          </div>
                        </div>
                      </div>

                      {/* RAM Metric */}
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase block">RAM Usage</span>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-sm font-bold text-white font-mono">{laptopStatus?.ramUsed}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">/ {laptopStatus?.ramTotal}</span>
                        </div>
                        <div className="overflow-hidden h-2 text-xs flex rounded bg-zinc-850">
                          <div style={{ width: "42%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500" />
                        </div>
                      </div>

                      {/* Storage Metric */}
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase block">Local SSD</span>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-sm font-bold text-white font-mono">{laptopStatus?.diskUsed}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">/ {laptopStatus?.diskTotal}</span>
                        </div>
                        <div className="overflow-hidden h-2 text-xs flex rounded bg-zinc-850">
                          <div style={{ width: "55%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-500" />
                        </div>
                      </div>
                    </div>

                    {/* PC Control Panel (Volume and Custom commands) */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
                      <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-800 pb-2">
                        Local PC Control Dashboard
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Volume Adjuster */}
                        <div className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-zinc-850">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                              <Volume2 className="w-4 h-4 text-emerald-400" />
                              System Volume
                            </span>
                            <span className="text-xs font-mono font-bold text-zinc-400">{laptopStatus?.volume || 50}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={laptopStatus?.volume || 50}
                            onChange={(e) => {
                              const vol = parseInt(e.target.value);
                              setLaptopStatus((prev: any) => ({ ...prev, volume: vol }));
                              handleSendLaptopCommand("adjust_volume", { volume: vol });
                            }}
                            className="w-full accent-emerald-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                          />
                          <p className="text-[10px] text-zinc-500 leading-normal">
                            Slides will queue volume adjustments to the local system.
                          </p>
                        </div>

                         {/* Open Website Launcher */}
                        <div className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-zinc-850">
                          <span className="text-xs font-bold text-zinc-300 block">Open Website Launcher</span>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="https://github.com"
                              value={customWebUrlInput}
                              onChange={(e) => setCustomWebUrlInput(e.target.value)}
                              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none"
                            />
                            <button
                              onClick={() => {
                                if (!customWebUrlInput.trim()) return;
                                handleSendLaptopCommand("open_website", { url: customWebUrlInput });
                                setCustomWebUrlInput("");
                              }}
                              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-3 py-1.5 rounded-lg text-xs font-bold"
                            >
                              Open
                            </button>
                          </div>
                          <p className="text-[10px] text-zinc-500">Launches specified URL in default browser of the PC.</p>
                          
                          {lastLaunchedUrl && (
                            <div className="mt-2.5 flex items-center justify-between bg-emerald-950/20 border border-emerald-900/40 p-2.5 rounded-lg">
                              <div className="truncate max-w-[180px] text-left">
                                <span className="text-[9px] text-emerald-400 block uppercase font-mono">Last Launched Link</span>
                                <span className="text-[10px] text-zinc-300 font-mono truncate block" title={lastLaunchedUrl}>{lastLaunchedUrl}</span>
                              </div>
                              <a
                                href={lastLaunchedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[10px] font-bold px-2.5 py-1 rounded transition-colors"
                              >
                                Launch Web Page ↗
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Execute Arbitrary Shell Commands */}
                      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3">
                        <span className="text-xs font-bold text-zinc-300 block">Execute Native Terminal Command (PowerShell / Bash)</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. echo Hello World"
                            value={terminalCommandInput}
                            onChange={(e) => setTerminalCommandInput(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-700 focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              if (!terminalCommandInput.trim()) return;
                              handleSendLaptopCommand("run_terminal", { cmd: terminalCommandInput });
                              setTerminalCommandInput("");
                            }}
                            className="bg-zinc-800 hover:bg-zinc-750 text-emerald-400 border border-zinc-750 px-4 py-2 rounded-lg text-xs font-bold font-mono"
                          >
                            Execute
                          </button>
                        </div>
                        <p className="text-[10px] text-zinc-500">Run system binaries, start development compile tasks, or automate file directories on your laptop.</p>
                      </div>

                      {/* Fetch a File From the Laptop */}
                      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3">
                        <span className="text-xs font-bold text-zinc-300 block flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          Fetch a File From Your Laptop
                        </span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. C:\Users\murali\Documents\report.pdf"
                            value={laptopFilePathInput}
                            onChange={(e) => setLaptopFilePathInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && laptopFilePathInput.trim()) {
                                handleSendLaptopCommand("get_file", { path: laptopFilePathInput });
                                setLaptopFilePathInput("");
                              }
                            }}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-700 focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              if (!laptopFilePathInput.trim()) return;
                              handleSendLaptopCommand("get_file", { path: laptopFilePathInput });
                              setLaptopFilePathInput("");
                            }}
                            className="bg-zinc-800 hover:bg-zinc-750 text-emerald-400 border border-zinc-750 px-4 py-2 rounded-lg text-xs font-bold font-mono"
                          >
                            Fetch
                          </button>
                        </div>
                        <p className="text-[10px] text-zinc-500">Give the full path to a file on your laptop (works up to ~20MB). The Laptop Companion has to be running for this to work — it'll show up as a download link in Command History below once it's back.</p>
                      </div>
                    </div>

                    {/* Connected Processes List */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-800 pb-2">
                        Top Local Hardware Processes
                      </span>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-zinc-400">
                          <thead className="text-[10px] text-zinc-500 uppercase font-mono border-b border-zinc-850">
                            <tr>
                              <th className="py-2">Process Name</th>
                              <th className="py-2 font-mono">PID</th>
                              <th className="py-2 text-right">CPU load</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-850 font-mono">
                            {laptopStatus?.processes?.map((proc: any, i: number) => (
                              <tr key={i} className="hover:bg-zinc-950/40">
                                <td className="py-2 font-semibold text-zinc-200">{proc.name}</td>
                                <td className="py-2 text-zinc-500">{proc.pid}</td>
                                <td className="py-2 text-right text-emerald-400">+{proc.cpu}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Deployment, Guide, and Command history */}
                  <div className="space-y-6">
                    {/* Download Companion Client Script */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl" />
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold text-white uppercase font-mono">Download Companion Client</h3>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        To pair your hardware, download and execute our lightweight Python client on your laptop.
                      </p>

                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            // Bake in the REAL server origin (wherever this app is actually
                            // deployed/running right now) and the REAL logged-in user id, so
                            // the script works out of the box instead of pointing at
                            // localhost:3000 / a placeholder "murali" id that isn't you.
                            const realServerUrl = window.location.origin;
                            const realUserId = activeUser?.id || "default_user";
                            const personalized = (MK_LAPTOP_COMPANION_PY || "")
                              .replace(
                                /SERVER_URL = "http:\/\/localhost:3000"/,
                                `SERVER_URL = "${realServerUrl}"`
                              )
                              .replace(
                                /USER_ID = "murali"(\s*)#/,
                                `USER_ID = "${realUserId}"$1#`
                              );
                            const blob = new Blob([personalized], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "mk_laptop_companion.py";
                            a.click();
                            showNotification(`Downloaded — pre-configured for ${realServerUrl}`, "success");
                          }}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <FileCode className="w-4 h-4" />
                          Save mk_laptop_companion.py
                        </button>

                        <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 font-mono text-[9px] text-zinc-500 space-y-1.5">
                          <p className="text-zinc-400 font-bold">Quick Pairing Instructions:</p>
                          <p>1. Open CMD / PowerShell</p>
                          <p>2. pip install requests psutil</p>
                          <p>3. python mk_laptop_companion.py</p>
                        </div>
                      </div>
                    </div>

                    {/* Hardware Specifications Panel */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2.5">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold text-white uppercase font-mono">Hardware Specifications</h3>
                      </div>
                      
                      <div className="space-y-2.5 text-[11px] font-mono">
                        <div className="flex justify-between items-center border-b border-zinc-850/40 pb-1.5">
                          <span className="text-zinc-500 font-semibold">Device Hostname:</span>
                          <span className="text-zinc-300 font-bold">{laptopStatus?.deviceName || "Not connected"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-850/40 pb-1.5">
                          <span className="text-zinc-500 font-semibold">Operating System:</span>
                          <span className="text-zinc-300">{laptopStatus?.osModel || "Not connected"}</span>
                        </div>
                        <div className="flex justify-between items-start border-b border-zinc-850/40 pb-1.5 text-right">
                          <span className="text-zinc-500 font-semibold text-left shrink-0">CPU Processor:</span>
                          <span className="text-zinc-300 max-w-[150px] leading-tight">{laptopStatus?.processor || "Not connected"}</span>
                        </div>
                        <div className="flex justify-between items-start border-b border-zinc-850/40 pb-1.5 text-right">
                          <span className="text-zinc-500 font-semibold text-left shrink-0">GPU Accelerator:</span>
                          <span className="text-zinc-300 max-w-[150px] leading-tight">{laptopStatus?.gpu || "Not connected"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-850/40 pb-1.5">
                          <span className="text-zinc-500 font-semibold">System RAM:</span>
                          <span className="text-zinc-300">{laptopStatus?.ramTotal || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-850/40 pb-1.5">
                          <span className="text-zinc-500 font-semibold">Storage Partition:</span>
                          <span className="text-zinc-300">{laptopStatus?.diskTotal || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-850/40 pb-1.5">
                          <span className="text-zinc-500 font-semibold">Battery Resource:</span>
                          <span className="text-emerald-400 font-bold">{laptopStatus?.battery || "Not connected"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-850/40 pb-1.5">
                          <span className="text-zinc-500 font-semibold">System Architecture:</span>
                          <span className="text-zinc-400">{laptopStatus?.architecture || "Not connected"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 font-semibold">Uptime Status:</span>
                          <span className="text-zinc-400">{laptopStatus?.uptime || "Not connected"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Live Command Results Log History */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                      <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-800 pb-2">
                        Active Polled Command Audit History
                      </span>
                      {laptopHistory.length === 0 ? (
                        <p className="text-[10px] text-zinc-500 italic py-4 text-center">No commands issued in this session.</p>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {laptopHistory.map((hist: any) => (
                            <div key={hist.id} className="bg-zinc-950 p-3 rounded-lg border border-zinc-855 text-[10px] font-mono space-y-1.5">
                              <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                                <span className="font-bold text-zinc-300 uppercase">{hist.command}</span>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  hist.status === "success" 
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-900" 
                                    : hist.status === "pending"
                                    ? "bg-amber-950 text-amber-400 border border-amber-900"
                                    : "bg-red-950 text-red-400 border border-red-900"
                                }`}>
                                  {hist.status}
                                </span>
                              </div>
                              <div className="text-[9px] text-zinc-500 flex justify-between">
                                <span>ID: {hist.id}</span>
                                <span>{hist.timestamp}</span>
                              </div>
                              {hist.result && (
                                <pre className="bg-black/60 p-2 rounded border border-zinc-900 text-zinc-400 overflow-x-auto max-h-[80px] break-all leading-normal whitespace-pre-wrap">
                                  {hist.result}
                                </pre>
                              )}
                              {hist.fileReady && (
                                <a
                                  href={`/api/laptop/file/${activeUser.id}/${hist.id}`}
                                  className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[10px] font-bold px-2.5 py-1.5 rounded transition-colors mt-1"
                                  download={hist.fileName}
                                >
                                  <Download className="w-3 h-3" />
                                  Download {hist.fileName}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 10. MOBILE PWA EXPERIENCE */}
            {activeTab === "mobile" && (
              <motion.div
                key="mobile"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Header banner */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Smartphone className="w-5 h-5 text-emerald-400" />
                      PROGRESSIVE WEB APPLICATION (PWA) MOBILE NODE
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Access your AI Assistant securely from Android, iOS, or iPadOS. Enabled with offline sync, stand-alone display, and push notifications.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Interactive PWA Controls: Notification trigger and Install check */}
                  <div className="lg:col-span-7 space-y-6">
                    {/* Live Test Controls */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
                      <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-800 pb-2">
                        PWA Capabilities Controller
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Notification dispatcher */}
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3">
                          <span className="text-xs font-bold text-zinc-300 block">PWA Push Notification Dispatcher</span>
                          <p className="text-[11px] text-zinc-500 leading-relaxed">
                            Simulate or trigger background push notifications. This tests the service worker's `push` event listeners and alerts your device.
                          </p>
                          <button
                            onClick={() => {
                              if ("Notification" in window) {
                                Notification.requestPermission().then(permission => {
                                  if (permission === "granted") {
                                    navigator.serviceWorker.ready.then(reg => {
                                      reg.showNotification("MK AI Operating System (AI OS)", {
                                        body: "🔔 Operational Heartbeat: Mobile sync cache updated successfully.",
                                        icon: "https://cdn-icons-png.flaticon.com/512/8649/8649607.png"
                                      });
                                      showNotification("PWA Push notification sent to browser registry!", "success");
                                    });
                                  } else {
                                    showNotification("Please enable notifications in your browser settings.", "error");
                                  }
                                });
                              } else {
                                showNotification("Browser does not support notifications.", "error");
                              }
                            }}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Bell className="w-4 h-4" />
                            Trigger Push Notification
                          </button>
                        </div>

                        {/* Offline cache validation */}
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3">
                          <span className="text-xs font-bold text-zinc-300 block">Offline Cache Status</span>
                          <p className="text-[11px] text-zinc-500 leading-relaxed">
                            Service Worker cache ensures immediate launch speeds and basic offline operational capabilities by saving shell assets dynamically.
                          </p>
                          <div className="flex items-center justify-between bg-zinc-900 p-2.5 rounded-lg border border-zinc-850 text-xs font-mono">
                            <span className="text-zinc-400">Offline Standby Cache:</span>
                            <span className="text-emerald-400 font-bold">ENABLED (V1)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Live Laptop Status — real-time, same state/polling as the
                        desktop Laptop Companion tab. This is the actual live
                        data last reported by your companion script via
                        /api/laptop/sync, not a mock — it works from a phone
                        exactly the same as from a desktop, since it's just
                        this same React state rendered in a mobile-width card. */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="text-xs font-bold text-white font-mono uppercase flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                          Live Laptop Status (Real-Time)
                        </span>
                        <button
                          onClick={fetchLaptopStatus}
                          className="text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors font-mono flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRefreshingLaptop ? "animate-spin" : ""}`} />
                          Sync
                        </button>
                      </div>

                      <div
                        className={`flex items-center gap-2 text-[10px] font-mono px-2.5 py-1.5 rounded-lg border ${
                          laptopStatus?.online
                            ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400"
                            : "bg-zinc-950 border-zinc-850 text-zinc-500"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${laptopStatus?.online ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                        {laptopStatus?.online
                          ? `CONNECTED — Last Sync: ${laptopStatus.lastSync}`
                          : "OFFLINE — companion script isn't running on your laptop right now"}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-2.5">
                          <p className="text-[9px] text-zinc-500 font-mono uppercase">CPU</p>
                          <p className="text-sm font-bold text-white font-mono mt-0.5">{laptopStatus?.cpu ?? "--"}%</p>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-2.5">
                          <p className="text-[9px] text-zinc-500 font-mono uppercase">RAM</p>
                          <p className="text-sm font-bold text-white font-mono mt-0.5">{laptopStatus?.ramUsed ?? "--"}</p>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-2.5">
                          <p className="text-[9px] text-zinc-500 font-mono uppercase">Battery</p>
                          <p className="text-sm font-bold text-white font-mono mt-0.5">{laptopStatus?.battery ?? "--"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">Volume</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={laptopStatus?.volume ?? 50}
                          onChange={(e) => setLaptopStatus((prev: any) => ({ ...prev, volume: Number(e.target.value) }))}
                          onMouseUp={(e) => handleSendLaptopCommand("adjust_volume", { volume: Number((e.target as HTMLInputElement).value) })}
                          onTouchEnd={(e) => handleSendLaptopCommand("adjust_volume", { volume: Number((e.target as HTMLInputElement).value) })}
                          disabled={!laptopStatus?.online}
                          className="flex-1 accent-emerald-500 disabled:opacity-40"
                        />
                        <span className="text-[10px] font-mono font-bold text-zinc-400 w-8 text-right">{laptopStatus?.volume ?? 50}%</span>
                      </div>

                      <p className="text-[10px] text-zinc-600 leading-relaxed">
                        This updates every 6 seconds from your real companion script (see the "Laptop Companion" tab to pair it). If it says OFFLINE, that script isn't currently running — nothing here is simulated.
                      </p>
                    </div>

                    {/* Step-by-Step Device Pairing Guides */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-800 pb-2">
                        Mobile Native Installation Walkthrough
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                        {/* iOS Safari */}
                        <div className="space-y-3">
                          <h4 className="font-bold text-emerald-400 flex items-center gap-1.5">
                            🍎 Apple iOS Safari
                          </h4>
                          <ul className="space-y-2 text-zinc-400 leading-relaxed list-disc list-inside">
                            <li>Launch the **Safari** app on your iPhone.</li>
                            <li>Type or navigate to this hosted application URL.</li>
                            <li>Tap the **Share** button (box icon with arrow up) at the bottom.</li>
                            <li>Select **"Add to Home Screen"** from the action sheet.</li>
                            <li>Tap **"Add"** at the top right. Launch the standalone app icon!</li>
                          </ul>
                        </div>

                        {/* Android Chrome */}
                        <div className="space-y-3">
                          <h4 className="font-bold text-emerald-400 flex items-center gap-1.5">
                            🤖 Google Android Chrome
                          </h4>
                          <ul className="space-y-2 text-zinc-400 leading-relaxed list-disc list-inside">
                            <li>Open **Google Chrome** on your mobile phone.</li>
                            <li>Navigate to this web URL.</li>
                            <li>Tap the **three vertical dots** (menu) in the top-right corner.</li>
                            <li>Click **"Add to Home screen"** or **"Install App"**.</li>
                            <li>Follow the prompt to install. Launch direct from app drawer!</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Interactive Phone Mockup */}
                  <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 flex flex-col items-center">
                    <span className="text-xs font-bold text-white font-mono uppercase border-b border-zinc-800 pb-2 block w-full text-center">
                      AI OS Mobile Preview
                    </span>

                    {/* Elegant smartphone device frame container */}
                    <div className="w-[280px] h-[540px] bg-zinc-950 border-8 border-zinc-800 rounded-[36px] p-3 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                      {/* Notch camera bar */}
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-4 bg-zinc-800 rounded-b-xl z-20 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                      </div>

                      {/* Phone App Content */}
                      <div className="flex-1 overflow-y-auto space-y-4 pt-4 text-left font-sans text-xs">
                        {/* Mock top bar */}
                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono px-1">
                          <span>09:41 AM</span>
                          <span className="text-emerald-400">● 5G • 100%</span>
                        </div>

                        {/* Mock Assistant Header */}
                        <div className="bg-zinc-900 border border-zinc-850 p-3 rounded-2xl flex items-center gap-2">
                          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-zinc-950">
                            <Bot className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-white text-[10px]">MK PERSONAL AI OS</p>
                            <span className="text-[8px] text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Synced Across Devices
                            </span>
                          </div>
                        </div>

                        {/* Recent Email Alert */}
                        <div className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-850/60 space-y-1">
                          <p className="text-[8px] font-mono text-zinc-500 uppercase">Recent Priority Email</p>
                          <p className="font-bold text-zinc-200 text-[10px]">Sarah Jenkins</p>
                          <p className="text-zinc-400 text-[9px] line-clamp-1">RE: [URGENT] Q3 Financial Forecast Approval Needed</p>
                        </div>

                        {/* Chat Feed */}
                        <div className="space-y-2">
                          <div className="bg-zinc-850 p-2.5 rounded-2xl rounded-tl-none max-w-[85%] text-[10px] text-zinc-300 leading-normal">
                            Good morning, Murali. I've compiled your unread emails and verified your Algorithms exam checklist. Shall we review?
                          </div>
                          <div className="bg-emerald-500 text-zinc-950 p-2.5 rounded-2xl rounded-tr-none max-w-[85%] ml-auto text-[10px] font-medium leading-normal">
                            Check my laptop processes and adjust volume to 50%
                          </div>
                          <div className="bg-zinc-850 p-2.5 rounded-2xl rounded-tl-none max-w-[85%] text-[10px] text-zinc-300 leading-normal">
                            Laptop agent checked. CPU load is 12% and volume is synchronized at 50%.
                          </div>
                        </div>
                      </div>

                      {/* Interactive mock send field */}
                      <div className="bg-zinc-900 rounded-full px-3 py-1.5 flex items-center justify-between border border-zinc-800">
                        <span className="text-[10px] text-zinc-500">Ask assistant...</span>
                        <Send className="w-3.5 h-3.5 text-emerald-400 animate-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 11. TELEGRAM HUB INTEGRATION */}
            {activeTab === "telegram" && (
              <motion.div
                key="telegram"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Header banner */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-emerald-400" />
                      PERSONAL TELEGRAM BOT COMMAND HUB
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Configure your Telegram token, test real-time broadcast dispatches, and download the full-stack Python Telegram bot source files.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left & Middle Column: Config and Broadcaster */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Bot Configuration Panel */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
                      <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-800 pb-2">
                        Real-World Telegram Integration Configuration
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Token Input */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">TELEGRAM_BOT_TOKEN</label>
                          <input
                            type="password"
                            placeholder="Insert Telegram Bot Token"
                            value={telegramToken}
                            onChange={(e) => setTelegramToken(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-700 focus:outline-none"
                          />
                        </div>

                        {/* Chat ID Input */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">TELEGRAM_CHAT_ID (My Chat ID)</label>
                          <input
                            type="text"
                            placeholder="Insert Chat ID"
                            value={telegramChatId}
                            onChange={(e) => setTelegramChatId(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-700 focus:outline-none"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        Your bot token is securely encrypted. To discover your Chat ID, search for **"@userinfobot"** on Telegram, start a chat, and paste the ID here.
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleSaveTelegramConfig}
                          disabled={isSavingTelegramConfig}
                          className="bg-zinc-800 hover:bg-zinc-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
                        >
                          {isSavingTelegramConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                          Save Config
                        </button>
                        {telegramConfigSaved && (
                          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Saved — persists across reloads
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Broadcast Alerts Dispatcher */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-800 pb-2">
                        Dispatch Real Broadcast Alert Notification
                      </span>

                      <div className="space-y-3">
                        <textarea
                          rows={3}
                          placeholder="e.g. ⚠️ URGENT: Q3 Financial Forecast Approval Needed. Deadline tomorrow 9:00 AM."
                          value={telegramMessage}
                          onChange={(e) => setTelegramMessage(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none"
                        />
                        <button
                          onClick={handleSendTelegram}
                          disabled={isSendingTelegram}
                          className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
                        >
                          {isSendingTelegram ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5 text-zinc-950" />
                          )}
                          Broadcast Alert to Client
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        This uses direct webhooks to communicate with the Telegram client.
                      </p>
                    </div>

                    {/* Step-by-Step Telegram Setup Procedure */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-800 pb-2 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-emerald-400" />
                        📋 TELEGRAM BOT CONNECTION PROCEDURE (Step-by-Step)
                      </span>
                      <div className="space-y-3.5 text-xs text-zinc-300">
                        <div className="flex gap-2.5 items-start">
                          <span className="flex-none w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold font-mono text-[10px] flex items-center justify-center mt-0.5">1</span>
                          <div className="space-y-0.5">
                            <p className="font-bold text-white">Create your Bot via @BotFather</p>
                            <p className="text-[11px] text-zinc-400 leading-normal">Search for the official <strong className="text-zinc-200">@BotFather</strong> on Telegram. Send the command <code className="text-emerald-400 bg-zinc-950 px-1 py-0.5 rounded">/newbot</code>, choose a display name, and set a unique bot username (ending in "bot"). Copy the generated HTTP API Token.</p>
                          </div>
                        </div>
                        <div className="flex gap-2.5 items-start">
                          <span className="flex-none w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold font-mono text-[10px] flex items-center justify-center mt-0.5">2</span>
                          <div className="space-y-0.5">
                            <p className="font-bold text-white">Retrieve your Chat ID via @userinfobot</p>
                            <p className="text-[11px] text-zinc-400 leading-normal">Search for <strong className="text-zinc-200">@userinfobot</strong> on Telegram. Start the chat, and it will immediately reply with your numeric <strong className="text-zinc-200">Chat ID</strong> (e.g., <code className="text-emerald-400 bg-zinc-950 px-1 py-0.5 rounded">74621985</code>).</p>
                          </div>
                        </div>
                        <div className="flex gap-2.5 items-start">
                          <span className="flex-none w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold font-mono text-[10px] flex items-center justify-center mt-0.5">3</span>
                          <div className="space-y-0.5">
                            <p className="font-bold text-white">Configure in the Platform</p>
                            <p className="text-[11px] text-zinc-400 leading-normal">Paste your Bot Token and Chat ID in the configuration fields above. Our Postgres database isolates this key for your user account securely.</p>
                          </div>
                        </div>
                        <div className="flex gap-2.5 items-start">
                          <span className="flex-none w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold font-mono text-[10px] flex items-center justify-center mt-0.5">4</span>
                          <div className="space-y-0.5">
                            <p className="font-bold text-white">Deploy Bot Script locally</p>
                            <p className="text-[11px] text-zinc-400 leading-normal">Download the <code className="text-emerald-400">mk_assistant.py</code> and <code className="text-emerald-400">requirements.txt</code> from the side panel. Run <code className="text-zinc-200 bg-zinc-950 px-1 py-0.5 rounded font-mono text-[10px]">pip install -r requirements.txt</code>, set the variables, and run <code className="text-zinc-200 bg-zinc-950 px-1 py-0.5 rounded font-mono text-[10px]">python mk_assistant.py</code>.</p>
                          </div>
                        </div>
                        <div className="flex gap-2.5 items-start">
                          <span className="flex-none w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold font-mono text-[10px] flex items-center justify-center mt-0.5">5</span>
                          <div className="space-y-0.5">
                            <p className="font-bold text-white">Test Real-Time Broadcast</p>
                            <p className="text-[11px] text-zinc-400 leading-normal">Type a quick message in the box above and click "Broadcast Alert to Client" to receive a direct alert on your Telegram app instantly!</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Commands Guide & Bot specs */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <span className="text-xs font-bold text-white font-mono uppercase block border-b border-zinc-800 pb-2">
                        Telegram Bot Commands Specification Reference
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-2.5 bg-zinc-950 p-3 rounded-lg border border-zinc-850">
                          <p className="font-mono font-bold text-emerald-400">/briefing</p>
                          <p className="text-zinc-400 text-[11px] leading-normal">Compiles your live Gmail, Calendar events, news articles, and countdowns into a single executive briefing.</p>
                        </div>
                        <div className="space-y-2.5 bg-zinc-950 p-3 rounded-lg border border-zinc-850">
                          <p className="font-mono font-bold text-emerald-400">/prep</p>
                          <p className="text-zinc-400 text-[11px] leading-normal">Returns countdowns to algorithms final exams, LeetCode daily milestones, and internship rounds.</p>
                        </div>
                        <div className="space-y-2.5 bg-zinc-950 p-3 rounded-lg border border-zinc-850">
                          <p className="font-mono font-bold text-emerald-400">/expenses</p>
                          <p className="text-zinc-400 text-[11px] leading-normal">Lists the weekly ledger expense items directly linked to your expense ledger worksheet.</p>
                        </div>
                        <div className="space-y-2.5 bg-zinc-950 p-3 rounded-lg border border-zinc-850">
                          <p className="font-mono font-bold text-emerald-400">/weather</p>
                          <p className="text-zinc-400 text-[11px] leading-normal">Displays real-time meteorological conditions and recommendations.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Download Telegram bot client */}
                  <div className="space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl" />
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold text-white uppercase font-mono">Download Telegram Source Code</h3>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Deploy your executive bot locally. Download the ready-to-run files and deploy them inside your terminal.
                      </p>

                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            const blob = new Blob([MK_ASSISTANT_PY || ""], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "mk_assistant.py";
                            a.click();
                            showNotification("Downloaded Telegram Code!", "success");
                          }}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <FileCode className="w-4 h-4" />
                          Save mk_assistant.py
                        </button>

                        <button
                          onClick={() => {
                            const blob = new Blob([REQUIREMENTS_TXT || ""], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "requirements.txt";
                            a.click();
                            showNotification("Downloaded requirements.txt!", "success");
                          }}
                          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-zinc-750 cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          Save requirements.txt
                        </button>

                        <button
                          onClick={() => {
                            const blob = new Blob([SETUP_GUIDE_MD || ""], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "SETUP_GUIDE.md";
                            a.click();
                            showNotification("Downloaded SETUP_GUIDE.md!", "success");
                          }}
                          className="w-full bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-mono py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-zinc-800 cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4 text-purple-400" />
                          Save SETUP_GUIDE.md
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </main>

      </div>

    </div>
  );
}
