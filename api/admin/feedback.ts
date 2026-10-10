import { checkSameOrigin, jsonBody, requireAdmin } from "../_auth";

type Request = { method?: string; query?: Record<string, string | string[] | undefined>; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
const statuses = new Set(["new", "reviewed", "resolved"]);
const types = new Set(["bug", "feature", "improvement", "general", "question"]);
function queryValue(req: Request, key: string) { const value = req.query?.[key]; return Array.isArray(value) ? value[0] : value; }
function databaseUrl(path: string) { return `${process.env.SUPABASE_URL?.replace(/\/$/, "")}/rest/v1/${path}`; }
function databaseHeaders() { const key = process.env.SUPABASE_SECRET_KEY ?? ""; return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }
function respondError(res: Response, status: number, error: string) { res.status(status).json({ ok: false, error }); }

export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (!requireAdmin(req, res)) return;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) { respondError(res, 503, "Database is not configured."); return; }
  if (req.method === "GET") {
    const page = Math.max(1, Number(queryValue(req, "page") ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(queryValue(req, "limit") ?? 20) || 20));
    const filters = ["select=id,type,title,description,email,status,created_at,additional_details", `limit=${limit}`, `offset=${(page - 1) * limit}`, "order=created_at.desc"];
    const type = queryValue(req, "type"); const status = queryValue(req, "status");
    if (type && types.has(type)) filters.push(`type=eq.${type}`);
    if (status && statuses.has(status)) filters.push(`status=eq.${status}`);
    const response = await fetch(`${databaseUrl("feedback")}?${filters.join("&")}`, { headers: { ...databaseHeaders(), Prefer: "count=exact" } });
    if (!response.ok) { respondError(res, 503, "Feedback could not be loaded."); return; }
    const range = response.headers.get("content-range") ?? "*/0";
    res.status(200).json({ ok: true, feedback: await response.json(), total: Number(range.split("/")[1]) || 0, page, limit });
    return;
  }
  if (!checkSameOrigin(req, res)) return;
  const id = queryValue(req, "id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) { respondError(res, 400, "A valid feedback id is required."); return; }
  if (req.method === "PATCH") {
    let body: Record<string, unknown>;
    try { body = jsonBody(req); } catch { respondError(res, 400, "Please send valid JSON."); return; }
    const status = typeof body.status === "string" ? body.status : "";
    if (!statuses.has(status)) { respondError(res, 400, "Choose a valid status."); return; }
    const response = await fetch(databaseUrl(`feedback?id=eq.${id}`), { method: "PATCH", headers: { ...databaseHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ status }) });
    if (!response.ok) { respondError(res, 503, "Feedback could not be updated."); return; }
    res.status(200).json({ ok: true }); return;
  }
  if (req.method === "DELETE") {
    const response = await fetch(databaseUrl(`feedback?id=eq.${id}`), { method: "DELETE", headers: databaseHeaders() });
    if (!response.ok) { respondError(res, 503, "Feedback could not be deleted."); return; }
    res.status(200).json({ ok: true }); return;
  }
  res.setHeader("Allow", "GET, PATCH, DELETE"); respondError(res, 405, "Method not allowed.");
}