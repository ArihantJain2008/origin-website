type Request = { method?: string };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).json({ ok: false }); return; }
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ""); const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { res.status(503).json({ ok: false, error: "Installer catalog is not configured." }); return; }
  try {
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const appResponse = await fetch(`${url}/rest/v1/applications?slug=eq.origin&select=id&limit=1`, { headers });
    if (!appResponse.ok) throw new Error("Application lookup failed");
    const [app] = await appResponse.json() as Array<{ id: string }>;
    if (!app) { res.status(200).json({ ok: true, assets: [] }); return; }
    const response = await fetch(`${url}/rest/v1/installer_assets?active=eq.true&select=id,platform,filename,byte_size,version:application_versions!inner(version,is_prerelease,released_at,application_id)&version.application_id=eq.${app.id}&version.is_prerelease=eq.false&order=created_at.desc`, { headers });
    if (!response.ok) throw new Error("Asset lookup failed");
    res.status(200).json({ ok: true, assets: await response.json() });
  } catch { res.status(503).json({ ok: false, error: "Installer catalog is temporarily unavailable." }); }
}
