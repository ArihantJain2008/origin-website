import { randomUUID } from "node:crypto";
import { visitorIdentity } from "../lib/api-handlers/downloads.js";
import { fetchOfficialInstaller, isUuid, isWholeInstallerTransfer, waitForDrainOrClose } from "./_installers.js";
import { authenticatedUser } from "./_account.js";

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type Response = { statusCode?: number; headersSent?: boolean; writableFinished?: boolean; destroyed?: boolean; status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string | string[]) => void; write: (chunk: Uint8Array) => boolean; end: () => void; on: (event: string, cb: (...args: unknown[]) => void) => void };
function header(req: Request, name: string) { const value = req.headers[name] ?? req.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] : value ?? ""; }
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") { res.setHeader("Allow", "GET, HEAD"); res.status(405).json({ ok: false }); return; }
  const assetValue = req.query?.asset; const assetId = Array.isArray(assetValue) ? assetValue[0] : assetValue;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ""); const key = process.env.SUPABASE_SECRET_KEY;
  if (!isUuid(assetId)) { res.status(400).json({ ok: false, error: "A valid installer id is required." }); return; }
  if (!url || !key || !(process.env.RATE_LIMIT_SALT || key)) { res.status(503).json({ ok: false, error: "Downloads are not configured." }); return; }
  const dbHeaders = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const signedIn = await authenticatedUser(req, res);
  const identityHash = signedIn ? null : visitorIdentity(req, res);
  let requestId = "";
  let terminalEventRecorded = false;
  let clientDisconnected = false;
  let resolveClientClose!: () => void;
  const clientClose = new Promise<void>((resolve) => { resolveClientClose = resolve; });
  const upstreamAbort = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) { clientDisconnected = true; upstreamAbort.abort(); resolveClientClose(); }
  });
  const record = async (type: string, requestId: string, bytes = 0, status?: number, fullTransfer = false) => {
    const body = { p_asset_id: assetId, p_identity_hash: identityHash, p_user_id: signedIn?.user.id ?? null, p_event_type: type, p_request_id: requestId, p_byte_count: bytes, p_http_status: status ?? null, p_user_agent: header(req, "user-agent"), p_full_transfer: fullTransfer };
    const response = await fetch(`${url}/rest/v1/rpc/record_download_event`, { method: "POST", headers: dbHeaders, body: JSON.stringify(body) });
    if (!response.ok) throw new Error("Download event could not be recorded");
  };
  try {
    const lookup = await fetch(`${url}/rest/v1/installer_assets?id=eq.${assetId}&active=eq.true&select=source_url,filename,byte_size&limit=1`, { headers: dbHeaders });
    if (!lookup.ok) throw new Error("Asset lookup failed");
    const [asset] = await lookup.json() as Array<{ source_url: string; filename: string; byte_size: number | null }>;
    let source: URL;
    try { source = new URL(asset?.source_url ?? ""); } catch { res.status(404).json({ ok: false, error: "Installer not found." }); return; }
    if (!asset || source.protocol !== "https:" || source.hostname !== "github.com" || !/^\/ArihantJain2008\/origin\/releases\/download\//.test(source.pathname)) { res.status(404).json({ ok: false, error: "Installer not found." }); return; }
    requestId = randomUUID();
    await record("requested", requestId);
    if (clientDisconnected) { await record("interrupted", requestId, 0); terminalEventRecorded = true; return; }
    const headers = new Headers();
    for (const name of ["range", "if-range", "if-none-match", "if-modified-since"]) { const value = header(req, name); if (value) headers.set(name, value); }
    const upstream = await fetchOfficialInstaller(asset.source_url, { method: req.method, headers, signal: upstreamAbort.signal });
    if (clientDisconnected) {
      if (upstream.body) { try { await upstream.body.cancel(); } catch { /* the upstream request has already closed */ } }
      await record("interrupted", requestId, 0);
      terminalEventRecorded = true;
      return;
    }
    let finalUrl: URL;
    try { finalUrl = new URL(upstream.url); } catch { throw new Error("Invalid upstream URL"); }
    if (!["github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"].includes(finalUrl.hostname)) { await record("failed", requestId, 0, 502); res.status(502).json({ ok: false, error: "Installer source could not be reached." }); return; }
    if (upstream.status === 304) {
      for (const name of ["etag", "last-modified"]) { const value = upstream.headers.get(name); if (value) res.setHeader(name, value); }
      await record("completed", requestId, 0, upstream.status);
      terminalEventRecorded = true;
      res.status(304).end();
      return;
    }
    if (!(upstream.status === 200 || upstream.status === 206)) { await record("failed", requestId, 0, upstream.status); terminalEventRecorded = true; res.status(upstream.status).json({ ok: false, error: "Installer source could not be reached." }); return; }
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) { const value = upstream.headers.get(name); if (value) res.setHeader(name, value); }
    res.setHeader("Content-Disposition", `attachment; filename="${asset.filename.replace(/[\\/"\x00-\x1f\x7f]/g, "_")}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(upstream.status);
    if (req.method === "HEAD") {
      await record("completed", requestId, 0, upstream.status);
      terminalEventRecorded = true;
      res.end();
      return;
    }
    if (!upstream.body) {
      await record("failed", requestId, 0, upstream.status);
      terminalEventRecorded = true;
      res.end();
      return;
    }
    let bytes = 0;
    const contentLengthHeader = upstream.headers.get("content-length");
    const contentLength = contentLengthHeader === null ? Number.NaN : Number(contentLengthHeader);
    const contentRange = upstream.headers.get("content-range");
    const recordInterrupted = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      try { await reader.cancel(); } catch { /* the client has already disconnected */ }
      await record("interrupted", requestId, bytes, upstream.status);
      terminalEventRecorded = true;
    };
    try {
      const reader = upstream.body.getReader();
      while (true) {
        const next = await Promise.race([
          reader.read().then((result: ReadableStreamReadResult<Uint8Array>) => ({ kind: "read" as const, result })),
          clientClose.then(() => ({ kind: "closed" as const })),
        ]);
        if (next.kind === "closed") { await recordInterrupted(reader); return; }
        const { done, value } = next.result;
        if (done) break;
        bytes += value.byteLength;
        if (!res.write(value)) {
          const canContinue = await waitForDrainOrClose(res, () => clientDisconnected);
          if (!canContinue) {
            await recordInterrupted(reader);
            return;
          }
        }
      }
      const fullTransfer = isWholeInstallerTransfer(upstream.status, contentRange, bytes, contentLength);
      if (Number.isFinite(contentLength) && bytes !== contentLength) throw new Error("Upstream transfer length mismatch");
      if (clientDisconnected) { await recordInterrupted(reader); return; }
      const finished = await new Promise<boolean>((resolve) => {
        res.on("finish", () => resolve(true));
        res.on("close", () => resolve(Boolean(res.writableFinished)));
        res.end();
      });
      if (!finished) { await record("interrupted", requestId, bytes, upstream.status); terminalEventRecorded = true; return; }
      await record("completed", requestId, bytes, upstream.status, fullTransfer);
      terminalEventRecorded = true;
    } catch (error) {
      await record("interrupted", requestId, bytes, upstream.status);
      terminalEventRecorded = true;
      throw error;
    }
  } catch {
    if (requestId && !terminalEventRecorded) {
      try { await record(clientDisconnected ? "interrupted" : "failed", requestId, 0, res.statusCode); terminalEventRecorded = true; } catch { /* retain the original transfer failure */ }
    }
    if (!res.headersSent && (!res.statusCode || res.statusCode < 400)) { res.status(502).json({ ok: false, error: "Installer transfer failed." }); }
  }
}
