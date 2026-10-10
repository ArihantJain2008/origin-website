import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "origin_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

type Request = { headers: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };

function header(req: Request, name: string) {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value ?? "";
}

function base64url(value: string | Buffer) { return Buffer.from(value).toString("base64url"); }
function secret() { return process.env.ADMIN_SESSION_SECRET ?? ""; }

export function passwordHash(password: string, encoded: string) {
  const [, salt, expected] = encoded.split("$");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "base64url");
  return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
}

export function makePasswordHash(password: string) {
  const salt = randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("base64url")}`;
}

export function createSession(email: string) {
  const payload = base64url(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }));
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function parseCookies(value: string) {
  return Object.fromEntries(value.split(";").map((part) => part.trim().split("=")).filter(([key, item]) => key && item));
}

export function getSession(req: Request) {
  const token = parseCookies(header(req, "cookie"))[COOKIE_NAME];
  if (!token || !secret()) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as { email?: string; exp?: number };
    return session.email && session.exp && session.exp > Math.floor(Date.now() / 1000) ? session : null;
  } catch { return null; }
}

export function setSessionCookie(res: Response, token: string) { res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`); }
export function clearSessionCookie(res: Response) { res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`); }

export function requireAdmin(req: Request, res: Response) {
  const session = getSession(req);
  if (!session || !process.env.ADMIN_EMAIL || session.email !== process.env.ADMIN_EMAIL) { res.status(401).json({ ok: false, error: "Authentication required." }); return null; }
  return session;
}

export function checkSameOrigin(req: Request, res: Response) {
  const origin = header(req, "origin");
  const host = header(req, "x-forwarded-host") || header(req, "host");
  if (origin && host && new URL(origin).host !== host) { res.status(403).json({ ok: false, error: "Invalid request origin." }); return false; }
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