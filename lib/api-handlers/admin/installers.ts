import { checkSameOrigin, jsonBody, requireAdmin, writeAdminAudit } from "../../../api/_auth.js";
import { isValidOfficialAsset, isValidOfficialRelease } from "../../../api/_installers.js";

type Request = { method?: string; query?: Record<string, string | string[] | undefined>; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
type AssetInput = { name: string; url: string; platform: string; size?: number };
function config() { const url = process.env.SUPABASE_URL?.replace(/\/$/, ""); const key = process.env.SUPABASE_SECRET_KEY; return url && key ? { url, key } : null; }
function dbHeaders(key: string, prefer?: string) { return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }; }
function error(res: Response, status: number, message: string) { res.status(status).json({ ok: false, error: message }); }

export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (!await requireAdmin(req, res)) return;
  const db = config(); if (!db) { error(res, 503, "Database is not configured."); return; }
  if (req.method === "GET") {
    try {
      const result = await fetch(`${db.url}/rest/v1/installer_assets?select=id,version_id,platform,filename,byte_size,active,version:application_versions!inner(version,is_prerelease,released_at)&order=created_at.desc&limit=200`, { headers: dbHeaders(db.key) });
      if (!result.ok) throw new Error();
      res.status(200).json({ ok: true, assets: await result.json() }); return;
    } catch { error(res, 503, "Installer assets could not be loaded."); return; }
  }
  if (req.method === "PATCH") {
    if (!checkSameOrigin(req, res)) return;
    const queryId = req.query?.id; const id = Array.isArray(queryId) ? queryId[0] : queryId;
    let body: Record<string, unknown>; try { body = jsonBody(req); } catch { error(res, 400, "Please send valid JSON."); return; }
    if (!id || !/^[0-9a-f-]{36}$/i.test(id) || typeof body.active !== "boolean") { error(res, 400, "A valid installer id and active state are required."); return; }
    const response = await fetch(`${db.url}/rest/v1/installer_assets?id=eq.${id}`, { method: "PATCH", headers: dbHeaders(db.key, "return=representation"), body: JSON.stringify({ active: body.active }) });
    if (!response.ok) { error(res, 503, "Installer status could not be updated."); return; }
    const [asset] = await response.json() as Array<{ id: string }>;
    if (!asset) { error(res, 404, "Installer was not found."); return; }
    await writeAdminAudit(process.env.ADMIN_EMAIL ?? "", body.active ? "installer.activate" : "installer.deactivate", "installer_asset", id);
    res.status(200).json({ ok: true }); return;
  }
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST, PATCH"); error(res, 405, "Method not allowed."); return; }
  if (!checkSameOrigin(req, res)) return;
  if (Number(req.headers["content-length"] ?? 0) > 64_000) { error(res, 413, "Request is too large."); return; }
  let body: Record<string, unknown>;
  try { body = jsonBody(req); } catch { error(res, 400, "Please send valid JSON."); return; }
  const version = typeof body.version === "string" ? body.version.trim() : "";
  const releaseUrl = typeof body.releaseUrl === "string" ? body.releaseUrl : "";
  const releasedAt = typeof body.releasedAt === "string" ? body.releasedAt : null;
  const prerelease = body.prerelease === true;
  const assets = body.assets;
  if (!isValidOfficialRelease(version, releaseUrl) || !Array.isArray(assets) || assets.length < 1 || assets.length > 20) { error(res, 400, "Release information is invalid."); return; }
  const clean: AssetInput[] = [];
  for (const value of assets as AssetInput[]) {
    if (!value || typeof value !== "object" || typeof value.platform !== "string" || !isValidOfficialAsset(version, value)) { error(res, 400, "Installer URL must match a supported official GitHub release asset."); return; }
    clean.push(value);
  }
  try {
    const versionResponse = await fetch(`${db.url}/rest/v1/application_versions?on_conflict=application_id,version`, { method: "POST", headers: dbHeaders(db.key, "resolution=merge-duplicates,return=representation"), body: JSON.stringify({ application_id: await applicationId(db.url, db.key), version, release_url: releaseUrl, released_at: releasedAt && Number.isFinite(Date.parse(releasedAt)) ? releasedAt : null, is_prerelease: prerelease }) });
    if (!versionResponse.ok) throw new Error("Release could not be saved");
    const [savedVersion] = await versionResponse.json() as Array<{ id: string }>;
    for (const asset of clean) {
      const assetResponse = await fetch(`${db.url}/rest/v1/installer_assets?on_conflict=version_id,filename`, { method: "POST", headers: dbHeaders(db.key, "resolution=merge-duplicates,return=minimal"), body: JSON.stringify({ version_id: savedVersion.id, platform: asset.platform, filename: asset.name, source_url: asset.url, byte_size: asset.size ?? null, active: true }) });
      if (!assetResponse.ok) throw new Error("Installer could not be saved");
    }
    await writeAdminAudit(process.env.ADMIN_EMAIL ?? "", "release.register", "application_version", savedVersion.id, { version, asset_count: clean.length });
    res.status(201).json({ ok: true, versionId: savedVersion.id, assetCount: clean.length });
  } catch { error(res, 503, "The release or installer assets could not be saved."); }
}

async function applicationId(url: string, key: string) {
  const result = await fetch(`${url}/rest/v1/applications?slug=eq.origin&select=id&limit=1`, { headers: dbHeaders(key) });
  if (!result.ok) throw new Error("Origin application is missing");
  const [application] = await result.json() as Array<{ id: string }>;
  if (!application) throw new Error("Origin application is missing");
  return application.id;
}
