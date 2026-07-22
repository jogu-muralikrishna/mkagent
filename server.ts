import path from "path";
import express from "express";
import { createServer as createViteServer } from "vite";
import app from "./api/_lib/app.js";

const PORT = Number(process.env.PORT) || 3000;

// Serve frontend assets in production / start development mode
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startAutomationScheduler(PORT);
  });
}

// Real time-based scheduling for automations, for persistent hosts (Render,
// Railway, a VPS, `npm run dev` locally, etc) where this process stays
// alive. Ticks every minute and hits the app's own /api/cron/run route,
// which checks Postgres for automations due "right now" and fires them
// (e.g. sends the Telegram message) — see api/_lib/app.ts.
//
// NOT used on Vercel: serverless functions don't stay running in the
// background, so there's nothing for setInterval to run inside of. Vercel
// deployments instead need vercel.json's "crons" entry to hit
// /api/cron/run on a schedule — see the comment there.
function startAutomationScheduler(port: number) {
  if (process.env.VERCEL) return;
  const url = `http://localhost:${port}/api/cron/run`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.CRON_SECRET) headers["x-cron-secret"] = process.env.CRON_SECRET;
  setInterval(async () => {
    try {
      await fetch(url, { method: "POST", headers });
    } catch (err: any) {
      console.error("[scheduler] cron tick failed:", err?.message || err);
    }
  }, 60 * 1000);
  console.log("[scheduler] In-process automation scheduler started (runs every 60s).");
}

setupServer();
