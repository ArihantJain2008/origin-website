import { checkSameOrigin, jsonBody, requireAdmin, writeAdminAudit } from "../_auth";

type Request = { method?: string; query?: Record<string, string | string[] | undefined>; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
function queryValue(req: Request, key: string) { const value = req.query?.[key]; return Array.isArray(value) ? value[0] : value ?? ""; }
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const admin = await requireAdmin(req, res); if (!admin) return;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ""); const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { res.status(503).json({ ok: false, error: "User directory is not configured." }); return; }
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (req.method === "GET") {
    const term = queryValue(req, "q").trim().toLowerCase();
    if (term.length < 2 || term.length > 254) { res.status(400).json({ ok: false, error: "Enter at least two search characters." }); return; }
    try {
      const users: Array<{ id: string; email?: string; created_at?: string; last_sign_in_at?: string }> = [];
      for (let page = 1; page <= 5; page++) {
        const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=100`, { headers });
        if (!response.ok) throw new Error("Auth directory request failed");
        const payload = await response.json() as { users?: typeof users };
        const batch = payload.users ?? [];
        users.push(...batch.filter((user) => (user.email ?? "").toLowerCase().includes(term)));
        if (batch.length < 100 || users.length >= 100) break;
      }
      const matches = users.slice(0, 100);
      const ids = matches.map((user) => user.id);
      let profiles: Array<{ id: string; display_name: string; suspended_at: string | null }> = [];
      if (ids.length) {
        const profileResponse = await fetch(`${url}/rest/v1/profiles?id=in.(${ids.join(",")})&select=id,display_name,suspended_at`, { headers });
        if (!profileResponse.ok) throw new Error("Profiles could not be loaded");
        profiles = await profileResponse.json();
      }
      res.status(200).json({ ok: true, users: matches.map((user) => ({ ...user, profile: profiles.find((profile) => profile.id === user.id) ?? null })) });
    } catch { res.status(503).json({ ok: false, error: "Users could not be searched." }); }
    return;
  }
  if (req.method !== "PATCH" || !checkSameOrigin(req, res)) { if (req.method !== "PATCH") { res.setHeader("Allow", "GET, PATCH"); res.status(405).json({ ok: false }); } return; }
  let body: Record<string, unknown>; try { body = jsonBody(req); } catch { res.status(400).json({ ok: false, error: "Invalid JSON." }); return; }
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.suspended !== "boolean") { res.status(400).json({ ok: false, error: "User and suspension state are required." }); return; }
  try {
    const response = await fetch(`${url}/rest/v1/rpc/set_origin_user_suspension`, { method: "POST", headers, body: JSON.stringify({ p_user_id: body.id, p_suspended: body.suspended }) });
    if (!response.ok) throw new Error();
    const revokedSessions = Number(await response.json());
    await writeAdminAudit(admin.email, body.suspended ? "user.suspend" : "user.unsuspend", "profile", body.id, { revoked_sessions: revokedSessions });
    res.status(200).json({ ok: true, revokedSessions });
  } catch { res.status(503).json({ ok: false, error: "User status could not be changed." }); }
}
