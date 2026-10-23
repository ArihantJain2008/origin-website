import { createClient } from "@supabase/supabase-js";

const PRODUCTION_APPLICATION_ID = "83e9d042-1b1b-4ce2-baa0-a737506ec617";

type ApiRequest = { method?: string };
type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Only GET requests are accepted." });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(503).json({ error: "Download count is unavailable." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { count, error } = await supabase
      .from("origin_github_unique_downloads")
      .select("*", { count: "exact", head: true })
      .eq("application_id", PRODUCTION_APPLICATION_ID);

    if (error || count === null) {
      console.error("Public download count query failed:", error?.message);
      res.status(503).json({ error: "Download count is unavailable." });
      return;
    }

    res.status(200).json({ count });
  } catch (error) {
    console.error(
      "Public download count error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    res.status(503).json({ error: "Download count is unavailable." });
  }
}
