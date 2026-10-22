import { checkSameOrigin, jsonBody, requireAdmin, writeAdminAudit } from "../../../api/_auth";

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const admin = await requireAdmin(req, res); if (!admin) return;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ""); const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { res.status(503).json({ ok: false, error: "Session storage is not configured." }); return; }
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  try {
    if (req.method === "GET") {
      const response = await fetch(`${url}/rest/v1/admin_sessions?revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,admin_email,created_at,expires_at,last_seen_at&order=created_at.desc&limit=100`, { headers });
      if (!response.ok) throw new Error();
      res.status(200).json({ ok: true, sessions: await response.json() }); return;
    }
    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); res.status(405).json({ ok: false }); return; }
    if (!checkSameOrigin(req, res)) return;
    let body: Record<string, unknown>; try { body = jsonBody(req); } catch { res.status(400).json({ ok: false, error: "Invalid JSON." }); return; }
    const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : "";
    const query = body.all === true ? "revoked_at=is.null" : id ? `id=eq.${id}&revoked_at=is.null` : "";
    if (!query) { res.status(400).json({ ok: false, error: "Choose a valid session or all sessions." }); return; }
    const response = await fetch(`${url}/rest/v1/admin_sessions?${query}`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ revoked_at: new Date().toISOString() }) });
    if (!response.ok) throw new Error();
    const rows = await response.json() as Array<{ id: string }>;
    await writeAdminAudit(admin.email, body.all === true ? "sessions.revoke_all" : "session.revoke", "admin_session", id || null, { revoked_count: rows.length });
    res.status(200).json({ ok: true, revokedCount: rows.length });
  } catch { res.status(503).json({ ok: false, error: "Admin sessions could not be updated." }); }
}
