import { useEffect, useState } from "react";
import { fetchReleases, type Release } from "./github";

export type ReleasesStatus = "loading" | "ready" | "error";

export interface UseReleasesResult {
  releases: Release[];
  latest: Release | null;
  status: ReleasesStatus;
}

/**
 * Loads releases from the GitHub API on mount. Never throws into the
 * render tree — on failure it resolves to `status: "error"` with an
 * empty release list, and every UI that reads this hook has a static
 * fallback for that case (see Download.tsx and Changelog.tsx).
 */
export function useReleases(): UseReleasesResult {
  const [releases, setReleases] = useState<Release[]>([]);
  const [status, setStatus] = useState<ReleasesStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();

    fetchReleases(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.length === 0) {
          setStatus("error");
          return;
        }
        setReleases(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });

    return () => controller.abort();
  }, []);

  const latest = releases.find((r) => !r.prerelease) ?? releases[0] ?? null;

  return { releases, latest, status };
}
