import { checkSameOrigin, clearSessionCookie, requireAdmin } from "../_auth";

export default function handler(req: { method?: string; headers: Record<string, string | string[] | undefined> }, res: { status: (code: number) => any; json: (body: unknown) => void; setHeader: (name: string, value: string) => void }) {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Only POST requests are accepted." }); return; }
  if (!requireAdmin(req, res) || !checkSameOrigin(req, res)) return;
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}