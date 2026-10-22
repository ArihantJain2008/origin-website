import { authConfig, authenticatedUser, clearAuthCookies, currentProfile, fail, jsonBody, sameOrigin, setAuthCookies, userDatabase, type AccountRequest, type AccountResponse } from "../_account.js";

type Tokens = { access_token: string; refresh_token: string; expires_in?: number; user?: { id: string; email?: string } };
const attempts = new Map<string, { count: number; until: number }>();
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function operation(req: AccountRequest) { const value = req.query?.op; return Array.isArray(value) ? value[0] : value ?? ""; }
function requestOrigin(req: AccountRequest) { const origin = req.headers.origin; return typeof origin === "string" ? new URL(origin).origin : ""; }
function allow(req: AccountRequest, op: string, max = 8) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ?? "unknown";
  const key = `${op}:${ip}`; const now = Date.now(); const item = attempts.get(key);
  if (item && item.until > now && item.count >= max) return false;
  attempts.set(key, item && item.until > now ? { count: item.count + 1, until: item.until } : { count: 1, until: now + 15 * 60 * 1000 });
  return true;
}
async function authRequest(path: string, init: RequestInit = {}) {
  const config = authConfig(); if (!config) throw new Error("Auth unavailable");
  return fetch(`${config.url}/auth/v1/${path}`, { ...init, headers: { apikey: config.anonKey, "Content-Type": "application/json", ...(init.headers ?? {}) } });
}
function errorMessage(status: number) { return status === 429 ? "Please wait a while and try again." : "The account request could not be completed."; }

export default async function handler(req: AccountRequest, res: AccountResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!authConfig()) { fail(res, 503, "Account features are not configured."); return; }
  const op = operation(req);
  if (req.method === "GET" && op === "me") {
    try {
      const session = await authenticatedUser(req, res);
      if (!session) { fail(res, 401, "Please sign in to view your account."); return; }
      const profile = await currentProfile(session.user.id, session.accessToken);
      const historyQuery = new URLSearchParams({ user_id: `eq.${session.user.id}`, event_type: "eq.completed", full_transfer: "eq.true", select: "id,asset_id,byte_count,created_at,installer_assets(filename,platform,application_versions(version))", order: "created_at.desc", limit: "100" });
      const historyResponse = await userDatabase(`download_events?${historyQuery}`, session.accessToken);
      if (!historyResponse.ok) throw new Error("History unavailable");
      res.status(200).json({ ok: true, user: { id: session.user.id, email: session.user.email ?? "" }, profile, downloads: await historyResponse.json() });
    } catch { fail(res, 503, "Account data is temporarily unavailable."); }
    return;
  }
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); fail(res, 405, "Method not allowed."); return; }
  if (!sameOrigin(req, res)) return;
  if (Number(req.headers["content-length"] ?? 0) > 16_000) { fail(res, 413, "Request is too large."); return; }
  let body: Record<string, unknown>;
  try { body = jsonBody(req); } catch { fail(res, 400, "Please send valid JSON."); return; }

  try {
    if (op === "register") {
      if (!allow(req, op)) { fail(res, 429, errorMessage(429)); return; }
      const email = text(body.email).toLowerCase(); const password = typeof body.password === "string" ? body.password : ""; const displayName = text(body.displayName);
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128 || displayName.length < 1 || displayName.length > 60) { fail(res, 400, "Enter a valid email, a password of at least 12 characters, and a display name of 1–60 characters."); return; }
      const baseUrl = requestOrigin(req);
      const redirect = `${baseUrl}/account?verified=1`;
      const response = await authRequest(`signup?redirect_to=${encodeURIComponent(redirect)}`, { method: "POST", body: JSON.stringify({ email, password, data: { display_name: displayName } }) });
      if (!response.ok) { fail(res, response.status === 429 ? 429 : 400, response.status === 429 ? errorMessage(429) : "Registration failed. Check your details or try signing in."); return; }
      const result = await response.json() as Tokens;
      if (result.access_token && result.refresh_token) setAuthCookies(res, result);
      res.status(201).json({ ok: true, verificationRequired: !result.access_token, message: result.access_token ? "Your account is ready." : "Check your email to verify your account." });
      return;
    }
    if (op === "login") {
      if (!allow(req, op)) { fail(res, 429, errorMessage(429)); return; }
      const email = text(body.email).toLowerCase(); const password = typeof body.password === "string" ? body.password : "";
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || !password || password.length > 128) { fail(res, 400, "Enter your email and password."); return; }
      const response = await authRequest("token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
      if (!response.ok) { fail(res, response.status === 429 ? 429 : 401, response.status === 429 ? errorMessage(429) : "Email or password is incorrect, or the email is not verified."); return; }
      const tokens = await response.json() as Tokens;
      if (!tokens.access_token || !tokens.refresh_token) { fail(res, 401, "Email or password is incorrect."); return; }
      setAuthCookies(res, tokens); res.status(200).json({ ok: true }); return;
    }
    if (op === "recover") {
      if (!allow(req, op, 5)) { fail(res, 429, errorMessage(429)); return; }
      const email = text(body.email).toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) { fail(res, 400, "Enter a valid email address."); return; }
      const baseUrl = requestOrigin(req);
      const response = await authRequest(`recover?redirect_to=${encodeURIComponent(`${baseUrl}/account?recovery=1`)}`, { method: "POST", body: JSON.stringify({ email }) });
      if (!response.ok) { res.status(200).json({ ok: true, message: "If an account matches, a recovery email will be sent shortly." }); return; }
      res.status(200).json({ ok: true, message: "If an account matches, a recovery email will be sent shortly." }); return;
    }
    if (op === "verify") {
      const tokenHash = text(body.token_hash); const type = text(body.type);
      if (!/^[A-Za-z0-9_-]{20,512}$/.test(tokenHash) || !["signup", "recovery", "email", "email_change"].includes(type)) { fail(res, 400, "Verification link is invalid or expired."); return; }
      const response = await authRequest("verify", { method: "POST", body: JSON.stringify({ token_hash: tokenHash, type }) });
      if (!response.ok) { fail(res, 400, "Verification link is invalid or expired."); return; }
      const result = await response.json() as Tokens;
      if (result.access_token && result.refresh_token) setAuthCookies(res, result);
      res.status(200).json({ ok: true, recovery: type === "recovery", message: type === "recovery" ? "Email verified. Set a new password." : type === "email_change" ? "Your email address has been updated." : "Email verified. You can sign in." }); return;
    }
    if (op === "logout") {
      const session = await authenticatedUser(req, res);
      if (session) {
        try { await authRequest("logout", { method: "POST", headers: { Authorization: `Bearer ${session.accessToken}` } }); }
        catch { /* local logout must still clear browser credentials */ }
      }
      clearAuthCookies(res); res.status(200).json({ ok: true }); return;
    }
    if (op === "profile") {
      const session = await authenticatedUser(req, res); if (!session) { fail(res, 401, "Sign in required."); return; }
      const displayName = text(body.displayName);
      if (displayName.length < 1 || displayName.length > 60) { fail(res, 400, "Display name must be 1–60 characters."); return; }
      const query = new URLSearchParams({ id: `eq.${session.user.id}` });
      const result = await userDatabase(`profiles?${query}`, session.accessToken, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ display_name: displayName, updated_at: new Date().toISOString() }) });
      if (!result.ok) { fail(res, 403, "Profile could not be updated."); return; }
      res.status(200).json({ ok: true }); return;
    }
    if (op === "password") {
      const session = await authenticatedUser(req, res); if (!session) { fail(res, 401, "Sign in required."); return; }
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 12 || password.length > 128) { fail(res, 400, "Password must be at least 12 characters."); return; }
      const result = await authRequest("user", { method: "PUT", headers: { Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify({ password }) });
      if (!result.ok) { fail(res, result.status === 429 ? 429 : 400, "Password could not be updated."); return; }
      res.status(200).json({ ok: true }); return;
    }
    if (op === "email") {
      const session = await authenticatedUser(req, res); if (!session) { fail(res, 401, "Sign in required."); return; }
      const email = text(body.email).toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) { fail(res, 400, "Enter a valid email address."); return; }
      const redirect = `${requestOrigin(req)}/account`;
      const result = await authRequest(`user?redirect_to=${encodeURIComponent(redirect)}`, { method: "PUT", headers: { Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify({ email }) });
      if (!result.ok) { fail(res, result.status === 429 ? 429 : 400, "Email change could not be requested."); return; }
      res.status(200).json({ ok: true, message: "Check your current and new email inboxes to confirm the change." }); return;
    }
    if (op === "delete") {
      const session = await authenticatedUser(req, res); if (!session) { fail(res, 401, "Sign in required."); return; }
      const config = authConfig();
      if (!config?.serviceKey) { fail(res, 503, "Account deletion is not configured."); return; }
      const result = await fetch(`${config.url}/auth/v1/admin/users/${encodeURIComponent(session.user.id)}`, { method: "DELETE", headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` } });
      if (!result.ok) { fail(res, 503, "Account could not be deleted."); return; }
      clearAuthCookies(res); res.status(200).json({ ok: true }); return;
    }
    fail(res, 404, "Unknown account operation.");
  } catch { fail(res, 503, "Account service is temporarily unavailable."); }
}
