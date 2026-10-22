import { checkSameOrigin, jsonBody, requireAdmin, writeAdminAudit } from "../../../api/_auth.js";

type Request = { method?: string; query?: Record<string, string | string[] | undefined>; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
const kinds = new Set(["reviews", "comments", "reports"]);
const statuses: Record<string, Set<string>> = { reviews: new Set(["published", "hidden", "removed"]), comments: new Set(["published", "hidden", "removed"]), reports: new Set(["open", "investigating", "resolved", "dismissed"]) };
function value(req: Request, key: string) { const item = req.query?.[key]; return Array.isArray(item) ? item[0] : item; }
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const admin = await requireAdmin(req, res); if (!admin) return;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ""); const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { res.status(503).json({ ok: false, error: "Database is not configured." }); return; }
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (req.method === "GET") {
    const kind = value(req, "kind") ?? "reports";
    if (!kinds.has(kind)) { res.status(400).json({ ok: false, error: "Choose reports, reviews, or comments." }); return; }
    try {
      const response = await fetch(`${url}/rest/v1/${kind}?select=*&order=created_at.desc&limit=200`, { headers });
      if (!response.ok) throw new Error();
      res.status(200).json({ ok: true, items: await response.json() });
    } catch { res.status(503).json({ ok: false, error: "Community moderation data is unavailable." }); }
    return;
  }
  if (req.method !== "PATCH" || !checkSameOrigin(req, res)) { if (req.method !== "PATCH") { res.setHeader("Allow", "GET, PATCH"); res.status(405).json({ ok: false }); } return; }
  const kind = value(req, "kind") ?? ""; const id = value(req, "id") ?? "";
  if (!kinds.has(kind) || !/^[0-9a-f-]{36}$/i.test(id)) { res.status(400).json({ ok: false, error: "Invalid moderation target." }); return; }
  let body: Record<string, unknown>; try { body = jsonBody(req); } catch { res.status(400).json({ ok: false, error: "Invalid JSON." }); return; }
  const status = typeof body.status === "string" ? body.status : "";
  if (!statuses[kind].has(status)) { res.status(400).json({ ok: false, error: "Invalid moderation status." }); return; }
  try {
    const response = await fetch(`${url}/rest/v1/${kind}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(kind === "reports" ? { status, resolved_at: ["resolved", "dismissed"].includes(status) ? new Date().toISOString() : null } : { status, updated_at: new Date().toISOString() }) });
    if (!response.ok) throw new Error();
    const [item] = await response.json() as unknown[];
    if (!item) { res.status(404).json({ ok: false, error: "Moderation target was not found." }); return; }
    await writeAdminAudit(admin.email, `moderate.${kind}`, kind, id, { status });
    res.status(200).json({ ok: true, item });
  } catch { res.status(503).json({ ok: false, error: "Moderation update failed." }); }
}
