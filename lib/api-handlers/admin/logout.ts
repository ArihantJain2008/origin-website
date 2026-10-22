import { checkSameOrigin, clearSessionCookie, requireAdmin, revokeSession, writeAdminAudit } from "../../../api/_auth";

export default async function handler(req: { method?: string; headers: Record<string, string | string[] | undefined> }, res: { status: (code: number) => any; json: (body: unknown) => void; setHeader: (name: string, value: string) => void }) {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Only POST requests are accepted." }); return; }
  const session = await requireAdmin(req, res);
  if (!session || !checkSameOrigin(req, res)) return;
  if (!await revokeSession(session.id)) { res.status(503).json({ ok: false, error: "Session could not be revoked." }); return; }
  await writeAdminAudit(session.email, "session.logout", "admin_session", session.id);
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}
