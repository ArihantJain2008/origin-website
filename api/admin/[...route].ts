import audit from "../../lib/api-handlers/admin/audit";
import community from "../../lib/api-handlers/admin/community";
import downloads from "../../lib/api-handlers/admin/downloads";
import feedback from "../../lib/api-handlers/admin/feedback";
import installers from "../../lib/api-handlers/admin/installers";
import login from "../../lib/api-handlers/admin/login";
import logout from "../../lib/api-handlers/admin/logout";
import me from "../../lib/api-handlers/admin/me";
import sessions from "../../lib/api-handlers/admin/sessions";
import users from "../../lib/api-handlers/admin/users";

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
  if (route.length !== 1) { res.status(404).json({ ok: false, error: "Admin API route was not found." }); return; }
  switch (route[0]) {
    case "audit": return audit(req as Parameters<typeof audit>[0], res as Parameters<typeof audit>[1]);
    case "community": return community(req as Parameters<typeof community>[0], res as Parameters<typeof community>[1]);
    case "downloads": return downloads(req as Parameters<typeof downloads>[0], res as Parameters<typeof downloads>[1]);
    case "feedback": return feedback(req as Parameters<typeof feedback>[0], res as Parameters<typeof feedback>[1]);
    case "installers": return installers(req as Parameters<typeof installers>[0], res as Parameters<typeof installers>[1]);
    case "login": return login(req as Parameters<typeof login>[0], res as Parameters<typeof login>[1]);
    case "logout": return logout(req as Parameters<typeof logout>[0], res as Parameters<typeof logout>[1]);
    case "me": return me(req as Parameters<typeof me>[0], res as Parameters<typeof me>[1]);
    case "sessions": return sessions(req as Parameters<typeof sessions>[0], res as Parameters<typeof sessions>[1]);
    case "users": return users(req as Parameters<typeof users>[0], res as Parameters<typeof users>[1]);
    default: res.status(404).json({ ok: false, error: "Admin API route was not found." });
  }
}
