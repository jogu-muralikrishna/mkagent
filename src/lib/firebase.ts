import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add required Workspace scopes
provider.addScope("https://www.googleapis.com/auth/gmail.readonly");
provider.addScope("https://www.googleapis.com/auth/calendar.events.readonly");
provider.addScope("https://www.googleapis.com/auth/userinfo.email");
provider.addScope("https://www.googleapis.com/auth/userinfo.profile");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Call this once on app startup (e.g. in a top-level useEffect) to capture
// the token after Google redirects back from the sign-in flow.
export const handleRedirectResult = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) return null;
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Redirect sign-in error:", error);
    throw error;
  }
};

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // In Firebase Auth, we cannot get the provider access token from the user object directly after reload,
      // so we rely on cachedAccessToken or prompt a quick silent login/popup login if needed.
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If we don't have the cached access token (e.g. after hard reload),
        // we'll flag that we need auth/re-connection.
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Main Sign-in method triggered by user click.
// This navigates the whole page to Google and back (see handleRedirectResult
// above for capturing the result on return) instead of opening a popup.
export const googleSignIn = async (): Promise<void> => {
  isSigningIn = true;
  await signInWithRedirect(auth, provider);
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Helper to fetch real unread emails from Gmail API
export interface RealEmail {
  id: string;
  sender: string;
  subject: string;
  time: string;
  priority: string;
  category: string;
  body: string;
}

export const fetchRealEmails = async (token: string): Promise<RealEmail[]> => {
  try {
    // List unread messages
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=8",
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (!listRes.ok) {
      throw new Error(`Gmail List API returned status ${listRes.status}`);
    }
    const listData = await listRes.json();
    const messages = listData.messages || [];
    
    if (messages.length === 0) {
      // Fetch general last messages if no unread found
      const listResAll = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5",
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (listResAll.ok) {
        const allData = await listResAll.json();
        messages.push(...(allData.messages || []));
      }
    }

    const fetchedEmails: RealEmail[] = [];
    
    // Fetch details for each message
    for (const msg of messages.slice(0, 5)) {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!detailRes.ok) continue;
      const detailData = await detailRes.json();
      
      const headers = detailData.payload?.headers || [];
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "Unknown Sender";
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "No Subject";
      const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";
      
      // Parse a nice user-friendly date
      let displayTime = "Today";
      try {
        if (dateHeader) {
          const emailDate = new Date(dateHeader);
          displayTime = emailDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          if (isNaN(emailDate.getTime())) {
            displayTime = dateHeader;
          } else {
            const today = new Date();
            if (emailDate.toDateString() !== today.toDateString()) {
              displayTime = emailDate.toLocaleDateString([], { month: "short", day: "numeric" });
            }
          }
        }
      } catch (err) {
        displayTime = dateHeader || "Unknown";
      }

      const bodyText = detailData.snippet || "";
      
      // Calculate dynamic priority
      let priority = "LOW";
      const lowerSubject = subjectHeader.toLowerCase();
      const lowerBody = bodyText.toLowerCase();
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

      // Calculate dynamic category
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

      fetchedEmails.push({
        id: msg.id,
        sender: fromHeader,
        subject: subjectHeader,
        time: displayTime,
        priority,
        category,
        body: bodyText
      });
    }

    return fetchedEmails;
  } catch (error) {
    console.error("Error fetching emails from Google API:", error);
    throw error;
  }
};

// Helper to fetch real calendar events from Google Calendar API
export interface RealCalendarEvent {
  title: string;
  date: string;
  type: string;
}

export const fetchRealCalendarEvents = async (token: string): Promise<RealCalendarEvent[]> => {
  try {
    const timeMin = new Date().toISOString();
    const calendarRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&orderBy=startTime&singleEvents=true&timeMin=${timeMin}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (!calendarRes.ok) {
      throw new Error(`Google Calendar API returned status ${calendarRes.status}`);
    }
    const calendarData = await calendarRes.json();
    const items = calendarData.items || [];
    
    return items.map((item: any) => {
      const title = item.summary || "No Title Event";
      const startObj = item.start || {};
      const startVal = startObj.dateTime || startObj.date || "";
      
      let displayDate = "";
      if (startVal) {
        try {
          const dateInstance = new Date(startVal);
          displayDate = dateInstance.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
        } catch {
          displayDate = startVal;
        }
      } else {
        displayDate = "Undated";
      }

      // Infer event type
      let type = "Meeting";
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes("exam") || lowerTitle.includes("quiz") || lowerTitle.includes("test")) {
        type = "Exam";
      } else if (lowerTitle.includes("class") || lowerTitle.includes("lecture") || lowerTitle.includes("course")) {
        type = "Class";
      } else if (lowerTitle.includes("deadline") || lowerTitle.includes("submit") || lowerTitle.includes("due")) {
        type = "Deadline";
      } else if (lowerTitle.includes("interview") || lowerTitle.includes("placement") || lowerTitle.includes("nvidia")) {
        type = "Placement";
      }

      return {
        title,
        date: displayDate,
        type
      };
    });
  } catch (error) {
    console.error("Error fetching calendar events from Google API:", error);
    throw error;
  }
};
