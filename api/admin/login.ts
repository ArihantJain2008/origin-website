import { checkSameOrigin, createSession, jsonBody, loginAllowed, passwordHash, setSessionCookie } from "../_auth";

export default function handler(req: { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }, res: { status: (code: number) => any; json: (body: unknown) => void; setHeader: (name: string, value: string) => void }) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Only POST requests are accepted." }); return; }
  if (!checkSameOrigin(req, res)) return;
  if (!loginAllowed(req)) { res.status(429).json({ ok: false, error: "Too many login attempts. Try again later." }); return; }
  let body: Record<string, unknown>;
  try { body = jsonBody(req); } catch { res.status(400).json({ ok: false, error: "Please send valid JSON." }); return; }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const valid = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_SESSION_SECRET) && email === process.env.ADMIN_EMAIL.toLowerCase() && passwordHash(password, process.env.ADMIN_PASSWORD_HASH);
  if (!valid) { res.status(401).json({ ok: false, error: "The email or password is incorrect." }); return; }
  setSessionCookie(res, createSession(email));
  res.status(200).json({ ok: true });
}