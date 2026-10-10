// GitHub release integration.
//
// The site never depends on this data to render — every consumer of
// this module must work with `releases: []` (e.g. if the GitHub API
// is unreachable, rate-limited, or returns an error). See useReleases().

export const REPO_OWNER = "ArihantJain2008";
export const REPO_NAME = "origin";
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
export const RELEASES_URL = `${REPO_URL}/releases`;
export const LATEST_RELEASE_URL = `${REPO_URL}/releases/latest`;
export const ISSUES_URL = `${REPO_URL}/issues`;

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface Release {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  body: string | null;
  assets: ReleaseAsset[];
}

export type Platform = "windows" | "macos-arm" | "macos-intel" | "linux" | "unknown";

/**
 * Best-effort client-side OS/arch detection. This is only ever used to
 * pick a *default* recommended download — it never blocks or hides
 * the other platform options.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent || "";
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } })
    .userAgentData?.platform;
  const uaData = (platform || navigator.platform || "").toLowerCase();

  if (/win/.test(uaData) || /windows/i.test(ua)) return "windows";

  if (/mac/.test(uaData) || /mac os x/i.test(ua)) {
    // Apple Silicon Macs report "MacIntel" for web compatibility, so
    // true architecture can't be determined reliably from the UA
    // string alone. We probe for Apple Silicon using a WebGL renderer
    // check, and fall back to "unknown arch" (both options shown) if
    // that isn't conclusive.
    try {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      const renderer = info ? (gl?.getParameter(info.UNMASKED_RENDERER_WEBGL) as string) : "";
      if (renderer && /Apple M/i.test(renderer)) return "macos-arm";
      if (renderer && /Apple GPU/i.test(renderer)) return "macos-arm";
    } catch {
      // Ignore — fall through to "unknown arch" mac handling below.
    }
    return "unknown";
  }

  if (/linux/.test(uaData) && !/android/i.test(ua)) return "linux";

  return "unknown";
}

/** Matches a release asset filename to a platform, without assuming a naming scheme beyond common Tauri bundler conventions. */
function assetPlatform(filename: string): Platform | null {
  const name = filename.toLowerCase();
  if (name.endsWith(".exe") || name.endsWith(".msi")) return "windows";
  if (name.endsWith(".appimage") || name.endsWith(".deb") || name.endsWith(".rpm")) return "linux";
  if (name.endsWith(".dmg") || name.endsWith(".app.tar.gz")) {
    if (name.includes("aarch64") || name.includes("arm64")) return "macos-arm";
    if (name.includes("x64") || name.includes("x86_64") || name.includes("intel")) return "macos-intel";
    return null;
  }
  return null;
}

export interface PlatformAsset {
  platform: Platform;
  asset: ReleaseAsset;
}

/** Extracts, from a release's real assets, which platforms currently have a downloadable installer. */
export function assetsByPlatform(release: Release | null): PlatformAsset[] {
  if (!release) return [];
  const found: PlatformAsset[] = [];
  for (const asset of release.assets) {
    const platform = assetPlatform(asset.name);
    if (platform) found.push({ platform, asset });
  }
  return found;
}

/**
 * Fetches releases from the GitHub REST API. Returns `[]` on any
 * failure (network error, rate limit, non-200) rather than throwing,
 * so callers can render a static fallback unconditionally.
 */
export async function fetchReleases(signal?: AbortSignal): Promise<Release[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
      { signal, headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as Release[];
    if (!Array.isArray(data)) return [];
    return data.filter((r) => !r.draft);
  } catch {
    return [];
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
