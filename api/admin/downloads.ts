import { requireAdmin } from "../_auth";

type Request = { method?: string; headers: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (!await requireAdmin(req, res)) return;
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).json({ ok: false }); return; }
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ""); const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { res.status(503).json({ ok: false, error: "Database is not configured." }); return; }
  try {
    const [response, uniqueResponse] = await Promise.all([
      fetch(`${url}/rest/v1/download_events?select=id,asset_id,event_type,full_transfer,request_id,byte_count,http_status,user_agent,created_at&order=created_at.desc&limit=500`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/unique_downloads?select=version_id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" } }),
    ]);
    if (!response.ok || !uniqueResponse.ok) throw new Error("Database request failed");
    const events = await response.json();
    const totals = { requested: 0, completed: 0, full_transfers: 0, interrupted: 0, failed: 0, unique_downloads: Number(uniqueResponse.headers.get("content-range")?.split("/")[1] ?? 0) };
    const days: Record<string, Omit<typeof totals, "unique_downloads">> = {};
    for (const event of events as Array<{ event_type: "requested" | "completed" | "interrupted" | "failed"; full_transfer: boolean; created_at: string }>) {
      if (event.event_type in totals) totals[event.event_type]++;
      const day = event.created_at.slice(0, 10); days[day] ??= { requested: 0, completed: 0, full_transfers: 0, interrupted: 0, failed: 0 };
      if (event.event_type in days[day]) days[day][event.event_type]++;
      if (event.event_type === "completed" && event.full_transfer) { totals.full_transfers++; days[day].full_transfers++; }
    }
    res.status(200).json({ ok: true, totals, trends: Object.entries(days).sort(([a], [b]) => a.localeCompare(b)), events });
  } catch { res.status(503).json({ ok: false, error: "Download analytics could not be loaded." }); }
}
