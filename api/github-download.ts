import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APPLICATION_ID = process.env.ANALYTICS_APPLICATION_ID || "";
const COOKIE_NAME = "origin_analytics_visitor";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function fail(res: ApiResponse, status: number, error: string) {
  res.status(status).json({ ok: false, error });
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function header(req: ApiRequest, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function platform(value: string): string {
  return ["windows", "macos", "linux"].includes(value) ? value : "unknown";
}

function userAgentFamily(value: string): string {
  if (/Edg\//i.test(value)) return "Edge";
  if (/OPR\//i.test(value)) return "Opera";
  if (/Firefox\//i.test(value)) return "Firefox";
  if (/Chrome\//i.test(value)) return "Chrome";
  if (/Safari\//i.test(value)) return "Safari";
  return "Other";
}

function signVisitorId(visitorId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`origin-visitor-v1:${APPLICATION_ID}:${visitorId}`)
    .digest("hex");
}

function validVisitorCookie(cookieHeader: string, secret: string): string | null {
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) return null;

  const token = cookie.slice(COOKIE_NAME.length + 1);
  const separator = token.lastIndexOf(".");
  if (separator < 0) return null;

  const visitorId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!isUuid(visitorId) || !/^[0-9a-f]{64}$/i.test(signature)) return null;

  const expected = signVisitorId(visitorId, secret);
  const suppliedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  return visitorId;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    fail(res, 405, "Only POST requests are accepted.");
    return;
  }

  if (Number(header(req, "content-length") || 0) > 3000) {
    fail(res, 413, "Request is too large.");
    return;
  }

  let body: Record<string, unknown>;
  try {
    body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body as Record<string, unknown>);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Invalid body");
    }
  } catch {
    fail(res, 400, "Please send valid JSON.");
    return;
  }

  const releaseTag = clean(body.releaseTag, 100);
  const assetName = clean(body.assetName, 250);
  const downloadPlatform = platform(clean(body.platform, 20));
  if (
    !releaseTag ||
    !assetName ||
    /[\r\n]/.test(releaseTag) ||
    /[\r\n]/.test(assetName)
  ) {
    fail(res, 400, "Invalid download tracking data.");
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const signingSecret = process.env.ANALYTICS_SIGNING_SECRET;
  if (!supabaseUrl || !serviceKey || !signingSecret || !APPLICATION_ID) {
    fail(res, 503, "Analytics service is not configured.");
    return;
  }

  const secureCookie =
    process.env.NODE_ENV === "production" ||
    header(req, "x-forwarded-proto").split(",")[0].trim() === "https";
  let visitorId = validVisitorCookie(header(req, "cookie"), signingSecret);
  if (!visitorId) {
    visitorId = randomUUID();
    const signature = signVisitorId(visitorId, signingSecret);
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${visitorId}.${signature}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secureCookie ? "; Secure" : ""}`
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const dedupeKey = createHash("sha256")
      .update(`origin:lifetime:${APPLICATION_ID}:${visitorId}`)
      .digest("hex");
    const { data: visitor, error: visitorError } = await supabase
      .from("origin_visitors")
      .upsert(
        { id: visitorId, last_seen_at: new Date().toISOString() },
        { onConflict: "id" }
      )
      .select("id")
      .single();

    if (visitorError || !visitor) {
      console.error("Analytics visitor upsert failed:", visitorError?.message);
      fail(res, 503, "Unable to record analytics.");
      return;
    }

    const userAgent = clean(header(req, "user-agent"), 500);
    const suspectedBot = /bot|crawler|spider|headless|curl|wget/i.test(userAgent);
    const { data: event, error: eventError } = await supabase
      .from("origin_github_download_events")
      .insert({
        application_id: APPLICATION_ID,
        visitor_id: visitor.id,
        release_tag: releaseTag,
        asset_name: assetName,
        platform: downloadPlatform,
        user_agent_family: userAgentFamily(userAgent),
        suspected_bot: suspectedBot,
      })
      .select("id")
      .single();

    if (eventError || !event) {
      console.error("GitHub download event insert failed:", eventError?.message);
      fail(res, 503, "Unable to record analytics.");
      return;
    }

    const { error: uniqueError } = await supabase
      .from("origin_github_unique_downloads")
      .upsert(
        {
          application_id: APPLICATION_ID,
          dedupe_key: dedupeKey,
          visitor_id: visitor.id,
          first_event_id: event.id,
        },
        {
          onConflict: "application_id,dedupe_key",
          ignoreDuplicates: true,
        }
      );

    if (uniqueError) {
      console.error("Unique download tracking failed:", uniqueError.message);
      fail(res, 503, "Unable to record unique analytics.");
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error(
      "GitHub analytics error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    fail(res, 503, "Analytics is temporarily unavailable.");
  }
}
