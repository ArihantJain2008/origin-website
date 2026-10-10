import { requireAdmin } from "../_auth";

export default function handler(req: { headers: Record<string, string | string[] | undefined> }, res: { status: (code: number) => any; json: (body: unknown) => void; setHeader: (name: string, value: string) => void }) {
  const session = requireAdmin(req, res);
  if (session) res.status(200).json({ ok: true, email: session.email });
}