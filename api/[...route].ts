import community from "../lib/api-handlers/community.js";
import downloads from "../lib/api-handlers/downloads.js";
import feedback from "../lib/api-handlers/feedback.js";
import installers from "../lib/api-handlers/installers.js";

type Request = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type NotFoundResponse = { status: (code: number) => NotFoundResponse; json: (body: unknown) => void };

export default async function handler(req: Request, res: NotFoundResponse) {
  const routeParam = req.query?.route;
  const route = Array.isArray(routeParam) ? routeParam : routeParam ? [routeParam] : [];
  if (route.length !== 1) { res.status(404).json({ ok: false, error: "API route was not found." }); return; }
  switch (route[0]) {
    case "community": return community(req as Parameters<typeof community>[0], res as Parameters<typeof community>[1]);
    case "downloads": return downloads(req as Parameters<typeof downloads>[0], res as Parameters<typeof downloads>[1]);
    case "feedback": return feedback(req as Parameters<typeof feedback>[0], res as Parameters<typeof feedback>[1]);
    case "installers": return installers(req as Parameters<typeof installers>[0], res as Parameters<typeof installers>[1]);
    default: res.status(404).json({ ok: false, error: "API route was not found." });
  }
}
