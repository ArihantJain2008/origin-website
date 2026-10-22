export type AccountRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown; query?: Record<string, string | string[] | undefined> };
export type AccountResponse = { status: (code: number) => AccountResponse; json: (body: unknown) => void; setHeader: (name: string, value: string | string[]) => void };
export type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };
export type AccountSession = { user: AuthUser; accessToken: string };
const ACCESS_COOKIE = "origin_user_access";
const REFRESH_COOKIE = "origin_user_refresh";
const MAX_SESSION_SECONDS = 60 * 60 * 24 * 30;

export function authConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  return url && anonKey ? { url, anonKey, serviceKey } : null;
}
function cookie(req: AccountRequest, name: string) {
  const raw = req.headers.cookie ?? "";
  const value = Array.isArray(raw) ? raw[0] : raw;
  for (const item of value.split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (key === name) return parts.join("=");
  }
  return "";
}
export function setAuthCookies(res: AccountResponse, session: { access_token: string; refresh_token: string; expires_in?: number }) {
  const accessAge = Math.max(60, Math.min(MAX_SESSION_SECONDS, Number(session.expires_in) || 3600));
  res.setHeader("Set-Cookie", [
    `${ACCESS_COOKIE}=${session.access_token}; Max-Age=${accessAge}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `${REFRESH_COOKIE}=${session.refresh_token}; Max-Age=${MAX_SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  ]);
}
export function clearAuthCookies(res: AccountResponse) {
  res.setHeader("Set-Cookie", [
    `${ACCESS_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `${REFRESH_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
  ]);
}
export function jsonBody(req: AccountRequest): Record<string, unknown> {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid JSON body");
  return body as Record<string, unknown>;
}
export function sameOrigin(req: AccountRequest, res: AccountResponse) {
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (!origin || !host || Array.isArray(origin) || Array.isArray(host)) { res.status(403).json({ ok: false, error: "Request origin is required." }); return false; }
  try { if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) throw new Error(); }
  catch { res.status(403).json({ ok: false, error: "Invalid request origin." }); return false; }
  return true;
}
async function authFetch(path: string, init: RequestInit = {}) {
  const config = authConfig(); if (!config) throw new Error("Account authentication is not configured");
  return fetch(`${config.url}/auth/v1/${path}`, { ...init, headers: { apikey: config.anonKey, "Content-Type": "application/json", ...(init.headers ?? {}) } });
}
export async function authenticatedUser(req: AccountRequest, res: AccountResponse): Promise<AccountSession | null> {
  const accessToken = cookie(req, ACCESS_COOKIE);
  const refreshToken = cookie(req, REFRESH_COOKIE);
  if (!accessToken && !refreshToken) return null;
  let response = accessToken ? await authFetch("user", { headers: { Authorization: `Bearer ${accessToken}` } }) : new Response(null, { status: 401 });
  if (response.status === 401 && refreshToken) {
    const refreshed = await authFetch("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) });
    if (!refreshed.ok) { clearAuthCookies(res); return null; }
    const tokens = await refreshed.json() as { access_token: string; refresh_token: string; expires_in?: number };
    setAuthCookies(res, tokens);
    response = await authFetch("user", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!response.ok) { clearAuthCookies(res); return null; }
    const user = await response.json() as AuthUser;
    return await isSuspended(user.id, tokens.access_token) ? null : { user, accessToken: tokens.access_token };
  }
  if (!response.ok) return null;
  const user = await response.json() as AuthUser;
  if (await isSuspended(user.id, accessToken)) return null;
  return { user, accessToken };
}
async function isSuspended(userId: string, token: string) {
  const config = authConfig(); if (!config) return false;
  const query = new URLSearchParams({ id: `eq.${userId}`, select: "suspended_at", limit: "1" });
  const response = await fetch(`${config.url}/rest/v1/profiles?${query}`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) return true;
  const [profile] = await response.json() as Array<{ suspended_at: string | null }>;
  return !profile || Boolean(profile.suspended_at);
}
export async function currentProfile(userId: string, token: string) {
  const config = authConfig(); if (!config) throw new Error("Account service is not configured");
  const query = new URLSearchParams({ id: `eq.${userId}`, select: "id,display_name,created_at", limit: "1" });
  const response = await fetch(`${config.url}/rest/v1/profiles?${query}`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Profile could not be loaded");
  const [profile] = await response.json() as Array<{ id: string; display_name: string; created_at: string }>;
  if (!profile) throw new Error("Profile is unavailable");
  return profile;
}
export async function userDatabase(path: string, token: string, init: RequestInit = {}) {
  const config = authConfig(); if (!config) throw new Error("Account service is not configured");
  return fetch(`${config.url}/rest/v1/${path}`, { ...init, headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
}
export function fail(res: AccountResponse, status: number, error: string) { res.status(status).json({ ok: false, error }); }
