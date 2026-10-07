import { createHash } from "node:crypto";

const TYPES = new Set(["bug", "feature", "improvement", "general", "question"]);
const LIMITS = { title: 120, description: 4000, email: 254, detail: 2000 };
const detailFields: Record<string, string[]> = {
  bug: ["what_happened", "expected_behavior", "steps_to_reproduce", "device", "os", "origin_version"],
  feature: ["request", "usefulness"],
  improvement: ["could_be_improved", "how_should_work"],
  question: ["trying_to_do", "problem_facing"],
  general: [],
};
const buckets = new Map<string, { count: number; resetAt: number }>();

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };

function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function fail(res: Response, status: number, error: string, fieldErrors: Record<string, string> = {}) { res.status(status).json({ ok: false, error, fieldErrors }); }

export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); fail(res, 405, "Only POST requests are accepted."); return; }
  if (Number(req.headers["content-length"] ?? 0) > 32_000) { fail(res, 413, "That request is too large."); return; }

  let body: Record<string, unknown>;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body as Record<string, unknown>);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid body");
  } catch { fail(res, 400, "Please send valid JSON."); return; }

  const type = text(body.type);
  const title = text(body.title);
  const description = text(body.description);
  const email = text(body.email);
  const fieldErrors: Record<string, string> = {};
  if (!TYPES.has(type)) fieldErrors.type = "Choose a valid feedback type.";
  if (title.length < 3) fieldErrors.title = "Title must be at least 3 characters.";
  if (title.length > LIMITS.title) fieldErrors.title = "Title must be 120 characters or fewer.";
  if (description.length < 10) fieldErrors.description = "Description must be at least 10 characters.";
  if (description.length > LIMITS.description) fieldErrors.description = "Description must be 4,000 characters or fewer.";
  if (email.length > LIMITS.email || (email && !/^\S+@\S+\.\S+$/.test(email))) fieldErrors.email = "Enter a valid email address.";
  if (text(body.website)) { fail(res, 400, "Automated submissions are not accepted."); return; }

  const additionalDetails: Record<string, string> = {};
  for (const key of detailFields[type] ?? []) {
    const value = text(body[key]);
    if (value.length < 2) fieldErrors[key] = "Please add a little more detail.";
    if (value.length > LIMITS.detail) fieldErrors[key] = "This field must be 2,000 characters or fewer.";
    if (value) additionalDetails[key] = value;
  }
  if (Object.keys(fieldErrors).length) { fail(res, 400, "Please check the highlighted fields.", fieldErrors); return; }

  const ipHeader = req.headers["x-forwarded-for"] ?? req.headers["x-real-ip"];
  const ip = text(Array.isArray(ipHeader) ? ipHeader[0] : ipHeader).split(",")[0].trim() || "unknown";
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!salt) { fail(res, 503, "Feedback is temporarily unavailable."); return; }
  const key = createHash("sha256").update(`${salt}:${ip}`).digest("hex");
  const now = Date.now();
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt > now && bucket.count >= 5) { fail(res, 429, "Please wait a little before sending more feedback."); return; }
  buckets.set(key, bucket && bucket.resetAt > now ? { count: bucket.count + 1, resetAt: bucket.resetAt } : { count: 1, resetAt: now + 60 * 60 * 1000 });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) { fail(res, 503, "Feedback is temporarily unavailable."); return; }
  try {
    const device = additionalDetails.device ?? null;
    const os = additionalDetails.os ?? null;
    const originVersion = additionalDetails.origin_version ?? null;
    const databaseResponse = await fetch(`${url.replace(/\/$/, "")}/rest/v1/feedback`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ type, title, description, email: email || null, additional_details: additionalDetails, device, os, origin_version: originVersion, status: "new" }),
    });
    if (!databaseResponse.ok) { fail(res, 503, "Feedback is temporarily unavailable."); return; }
    res.status(201).json({ ok: true });
  } catch { fail(res, 503, "Feedback is temporarily unavailable."); }
}