import { requireAdmin } from "../../../api/_auth";
type Request = { method?: string; headers: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store"); if (!await requireAdmin(req, res)) return;
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).json({ ok: false }); return; }
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ""); const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { res.status(503).json({ ok: false, error: "Audit log is not configured." }); return; }
  try {
    const result = await fetch(`${url}/rest/v1/admin_audit_logs?select=id,admin_email,action,entity_type,entity_id,details,created_at&order=created_at.desc&limit=200`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!result.ok) throw new Error();
    res.status(200).json({ ok: true, entries: await result.json() });
  } catch { res.status(503).json({ ok: false, error: "Audit log could not be loaded." }); }
}
