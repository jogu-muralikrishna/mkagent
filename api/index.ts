import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "./_lib/app.js";

// Vercel calls this function for every request matched by the /api/(.*) rewrite
// in vercel.json. The underlying Express app still defines its routes with the
// full "/api/..." prefix (e.g. app.get("/api/health", ...)), so we just hand
// the request straight to it.
export default function handler(req: VercelRequest, res: VercelResponse) {
  return (app as any)(req, res);
}
