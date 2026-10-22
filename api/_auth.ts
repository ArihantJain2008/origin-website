import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "__Host-origin_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

type Request = { headers: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };

function header(req: Request, name: string) {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value ?? "";
}

function adminDb() { const url = process.env.SUPABASE_URL?.replace(/\/$/, ""); const key = process.env.SUPABASE_SECRET_KEY; return url && key ? { url, key } : null; }
function sessionHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

export function passwordHash(password: string, encoded: string) {
  if (password.length > 1024 || encoded.length > 256) return false;
  const [algorithm, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !/^[A-Za-z0-9_-]{16,64}$/.test(salt) || !expected || !/^[A-Za-z0-9_-]{80,100}$/.test(expected)) return false;
  try {
    const actual = scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, "base64url");
    return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
  } catch { return false; }
}

export function makePasswordHash(password: string) {
  const salt = randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("base64url")}`;
}

export async function createSession(email: string) {
  const db = adminDb();
  if (!db) throw new Error("Admin session storage is unavailable");
  const token = randomBytes(32).toString("base64url");
  const response = await fetch(`${db.url}/rest/v1/admin_sessions`, { method: "POST", headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ token_hash: sessionHash(token), admin_email: email, expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString() }) });
  if (!response.ok) throw new Error("Admin session could not be stored");
  const [session] = await response.json() as Array<{ id: string }>;
  if (!session?.id || !await writeAdminAudit(email, "session.create", "admin_session", session.id)) {
    if (session?.id) await revokeSession(session.id);
    throw new Error("Admin session audit could not be stored");
  }
  return token;
}

function parseCookies(value: string) {
  return Object.fromEntries(value.split(";").map((part) => part.trim().split("=")).filter(([key, item]) => key && item));
}

export async function getSession(req: Request) {
  const token = parseCookies(header(req, "cookie"))[COOKIE_NAME];
  const db = adminDb();
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token) || !db) return null;
  try {
    const query = new URLSearchParams({ token_hash: `eq.${sessionHash(token)}`, revoked_at: "is.null", expires_at: `gt.${new Date().toISOString()}`, select: "id,admin_email,expires_at" });
    const response = await fetch(`${db.url}/rest/v1/admin_sessions?${query}`, { headers: { apikey: db.key, Authorization: `Bearer ${db.key}` } });
    if (!response.ok) return null;
    const [session] = await response.json() as Array<{ id: string; admin_email: string; expires_at: string }>;
    if (!session || session.admin_email.trim().toLowerCase() !== process.env.ADMIN_EMAIL?.trim().toLowerCase()) return null;
    return { id: session.id, email: session.admin_email, expiresAt: session.expires_at, token };
  } catch { return null; }
}

export function setSessionCookie(res: Response, token: string) { res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`); }
export function clearSessionCookie(res: Response) { res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`); }

export async function revokeSession(sessionId: string) {
  const db = adminDb(); if (!db) return false;
  const response = await fetch(`${db.url}/rest/v1/admin_sessions?id=eq.${encodeURIComponent(sessionId)}&revoked_at=is.null`, { method: "PATCH", headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ revoked_at: new Date().toISOString() }) });
  return response.ok;
}
export async function writeAdminAudit(adminEmail: string, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  const db = adminDb(); if (!db) return false;
  const response = await fetch(`${db.url}/rest/v1/admin_audit_logs`, { method: "POST", headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ admin_email: adminEmail, action, entity_type: entityType, entity_id: entityId, details }) });
  return response.ok;
}

export async function requireAdmin(req: Request, res: Response) {
  const session = await getSession(req);
  if (!session || !process.env.ADMIN_EMAIL || session.email?.toLowerCase() !== process.env.ADMIN_EMAIL.trim().toLowerCase()) { res.status(401).json({ ok: false, error: "Authentication required." }); return null; }
  if (Math.random() < 0.05) {
    const db = adminDb();
    if (db) void fetch(`${db.url}/rest/v1/admin_sessions?id=eq.${session.id}`, { method: "PATCH", headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ last_seen_at: new Date().toISOString() }) });
  }
  return session;
}

export function checkSameOrigin(req: Request, res: Response) {
  const origin = header(req, "origin");
  const host = header(req, "x-forwarded-host") || header(req, "host");
  if (!origin || !host) { res.status(403).json({ ok: false, error: "Request origin is required." }); return false; }
  try { if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) { res.status(403).json({ ok: false, error: "Invalid request origin." }); return false; } }
  catch { res.status(403).json({ ok: false, error: "Invalid request origin." }); return false; }
  return true;
}

export function loginAllowed(req: Request) {
  const ip = header(req, "x-forwarded-for").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const bucket = loginAttempts.get(ip);
  if (bucket && bucket.resetAt > now && bucket.count >= 8) return false;
  loginAttempts.set(ip, bucket && bucket.resetAt > now ? { count: bucket.count + 1, resetAt: bucket.resetAt } : { count: 1, resetAt: now + 15 * 60 * 1000 });
  return true;
}

export function jsonBody(req: { body?: unknown }) { return typeof req.body === "string" ? JSON.parse(req.body) as Record<string, unknown> : (req.body ?? {}) as Record<string, unknown>; }
