import { createHash, randomBytes } from "node:crypto";
import { isUuid } from "../../api/_installers.js";

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
function header(req: Request, name: string) { const v = req.headers[name] ?? req.headers[name.toLowerCase()]; return Array.isArray(v) ? v[0] : v ?? ""; }
const base = () => process.env.SUPABASE_URL?.replace(/\/$/, "") ?? "";
const key = () => process.env.SUPABASE_SECRET_KEY ?? "";
const dbHeaders = () => ({ apikey: key(), Authorization: `Bearer ${key()}`, "Content-Type": "application/json" });

// Public aggregate only; detailed events remain server-side for the admin API.
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).json({ ok: false }); return; }
  const config = base() && key();
  if (!config) { res.status(503).json({ ok: false, error: "Download data is not configured." }); return; }
  const assetValue = req.query?.asset;
  const assetId = Array.isArray(assetValue) ? assetValue[0] : assetValue;
  if (!isUuid(assetId)) { res.status(400).json({ ok: false, error: "A valid asset id is required." }); return; }
  try {
    const assetResponse = await fetch(`${base()}/rest/v1/installer_assets?id=eq.${assetId}&active=eq.true&select=version_id&limit=1`, { headers: dbHeaders() });
    if (!assetResponse.ok) throw new Error("Asset request failed");
    const [asset] = await assetResponse.json() as Array<{ version_id: string }>;
    if (!asset) { res.status(404).json({ ok: false, error: "Installer not found." }); return; }
    const response = await fetch(`${base()}/rest/v1/unique_downloads?version_id=eq.${asset.version_id}&select=version_id&limit=1`, { headers: { ...dbHeaders(), Prefer: "count=exact", Range: "0-0" } });
    if (!response.ok) throw new Error("Database request failed");
    const total = Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
    res.status(200).json({ ok: true, uniqueDownloads: Number.isFinite(total) ? total : 0 });
  } catch { res.status(503).json({ ok: false, error: "Download count is temporarily unavailable." }); }
}

// Shared identity helpers used by the streaming endpoint.
export function visitorIdentity(req: Request, res: { setHeader: (name: string, value: string) => void }) {
  const cookies = Object.fromEntries(header(req, "cookie").split(";").map((part) => part.trim().split("=")).filter(([k, v]) => k && v));
  let id = cookies.origin_visitor;
  if (!id || !/^[A-Za-z0-9_-]{40,60}$/.test(id)) {
    id = randomBytes(32).toString("base64url");
    res.setHeader("Set-Cookie", `origin_visitor=${id}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`);
  }
  return createHash("sha256").update(`${process.env.RATE_LIMIT_SALT || key()}:${id}`).digest("hex");
}
