import { authenticatedUser, authConfig, fail, jsonBody, sameOrigin, userDatabase, type AccountRequest, type AccountResponse } from "./_account";
import { isUuid } from "./_installers.js";

const requests = new Map<string, { count: number; until: number }>();
function param(req: AccountRequest, name: string) { const value = req.query?.[name]; return Array.isArray(value) ? value[0] : value ?? ""; }
function limited(key: string, max = 12) {
  const now = Date.now(); const prior = requests.get(key);
  if (prior && prior.until > now && prior.count >= max) return true;
  requests.set(key, prior && prior.until > now ? { count: prior.count + 1, until: prior.until } : { count: 1, until: now + 60 * 60 * 1000 });
  return false;
}
function validBody(value: unknown, min: number, max: number) { return typeof value === "string" && value.trim().length >= min && value.trim().length <= max; }
async function applicationId(value: unknown) {
  if (isUuid(value)) return value;
  if (value !== "origin") return null;
  const config = authConfig(); if (!config) return null;
  const response = await fetch(`${config.url}/rest/v1/applications?slug=eq.origin&select=id&limit=1`, { headers: { apikey: config.anonKey } });
  if (!response.ok) return null;
  const [application] = await response.json() as Array<{ id: string }>;
  return application?.id ?? null;
}
export default async function handler(req: AccountRequest, res: AccountResponse) {
  res.setHeader("Cache-Control", "no-store");
  const kind = param(req, "kind");
  if (!authConfig()) { fail(res, 503, "Community service is not configured."); return; }
  try {
    if (req.method === "GET") {
      if (!(["reviews", "comments"].includes(kind))) { fail(res, 400, "Choose reviews or comments."); return; }
      const appId = await applicationId(param(req, "application")); if (!appId) { fail(res, 400, "Application was not found."); return; }
      const query = new URLSearchParams({ application_id: `eq.${appId}`, status: "eq.published", select: kind === "reviews" ? "id,user_id,rating,body,created_at,updated_at" : "id,user_id,parent_id,body,created_at,updated_at", order: "created_at.desc", limit: "100" });
      const result = await fetch(`${authConfig()!.url}/rest/v1/${kind}?${query}`, { headers: { apikey: authConfig()!.anonKey } });
      if (!result.ok) throw new Error("Public content query failed");
      res.status(200).json({ ok: true, items: await result.json() }); return;
    }
    if (!["POST", "PATCH", "DELETE"].includes(req.method ?? "")) { res.setHeader("Allow", "GET, POST, PATCH, DELETE"); fail(res, 405, "Method not allowed."); return; }
    if (!sameOrigin(req, res)) return;
    const session = await authenticatedUser(req, res); if (!session) { fail(res, 401, "Sign in is required for this action."); return; }
    const limitKey = `${session.user.id}:${kind}`;
    if (limited(limitKey, kind === "reports" ? 5 : 20)) { fail(res, 429, "Please wait before submitting more content."); return; }
    const resource = kind === "review" ? "reviews" : kind === "comment" ? "comments" : kind === "report" ? "reports" : "";
    if (!resource) { fail(res, 400, "Choose a review, comment, or report."); return; }
    if (req.method === "POST") {
      const body = jsonBody(req);
      let values: Record<string, unknown>;
      if (kind === "review") {
        const rating = Number(body.rating);
        const appId = await applicationId(body.applicationId);
        if (!appId || !Number.isInteger(rating) || rating < 1 || rating > 5 || !validBody(body.body, 1, 4000)) { fail(res, 400, "Review requires an application, a rating from 1–5, and 1–4,000 characters."); return; }
        values = { application_id: appId, user_id: session.user.id, rating, body: (body.body as string).trim() };
      } else if (kind === "comment") {
        const appId = await applicationId(body.applicationId);
        if (!appId || !validBody(body.body, 1, 4000) || (body.parentId && !isUuid(body.parentId))) { fail(res, 400, "Comment details are invalid."); return; }
        if (body.parentId) {
          const parentQuery = new URLSearchParams({ id: `eq.${body.parentId}`, application_id: `eq.${appId}`, status: "eq.published", select: "id", limit: "1" });
          const parent = await userDatabase(`comments?${parentQuery}`, session.accessToken);
          if (!parent.ok || !(await parent.json() as unknown[]).length) { fail(res, 400, "The parent comment is unavailable."); return; }
        }
        values = { application_id: appId, user_id: session.user.id, parent_id: body.parentId || null, body: (body.body as string).trim() };
      } else {
        if (!isUuid(body.targetId) || !["review", "comment", "user", "application"].includes(String(body.targetType)) || !validBody(body.reason, 5, 2000)) { fail(res, 400, "Report details are invalid."); return; }
        values = { reporter_id: session.user.id, target_type: body.targetType, target_id: body.targetId, reason: (body.reason as string).trim() };
      }
      const result = await userDatabase(resource, session.accessToken, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(values) });
      if (!result.ok) { const duplicate = result.status === 409; fail(res, duplicate ? 409 : 400, duplicate ? "You have already submitted this item." : "Content could not be submitted."); return; }
      res.status(201).json({ ok: true, item: (await result.json() as unknown[])[0] }); return;
    }
    const id = param(req, "id"); if (!isUuid(id) || kind === "report") { fail(res, 400, "A valid content id is required."); return; }
    const where = new URLSearchParams({ id: `eq.${id}`, user_id: `eq.${session.user.id}` });
    if (req.method === "DELETE") {
      const result = await userDatabase(`${resource}?${where}`, session.accessToken, { method: "DELETE", headers: { Prefer: "return=representation" } });
      if (!result.ok) { fail(res, 403, "You cannot remove this content."); return; }
      const rows = await result.json() as unknown[]; if (!rows.length) { fail(res, 404, "Content was not found."); return; }
      res.status(200).json({ ok: true }); return;
    }
    const body = jsonBody(req);
    const updatedBody = typeof body.body === "string" ? body.body.trim() : "";
    const updatedRating = Number(body.rating);
    const patch: Record<string, unknown> = kind === "review" ? { rating: updatedRating, body: updatedBody } : { body: updatedBody };
    if ((kind === "review" && (!Number.isInteger(updatedRating) || updatedRating < 1 || updatedRating > 5)) || !validBody(updatedBody, 1, 4000)) { fail(res, 400, "Updated content is invalid."); return; }
    const result = await userDatabase(`${resource}?${where}`, session.accessToken, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
    if (!result.ok) { fail(res, 403, "You cannot update this content."); return; }
    const rows = await result.json() as unknown[]; if (!rows.length) { fail(res, 404, "Content was not found."); return; }
    res.status(200).json({ ok: true, item: rows[0] });
  } catch { fail(res, 503, "Community service is temporarily unavailable."); }
}
