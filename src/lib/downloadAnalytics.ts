type DownloadPlatform = "windows" | "macos" | "linux";

export function trackGitHubDownload(
  releaseTag: string,
  assetName: string,
  platform: DownloadPlatform
) {
  try {
    void fetch("/api/github-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseTag, assetName, platform }),
      keepalive: true,
    }).catch(() => {
      // Tracking is best-effort and must never interfere with the download.
    });
  } catch {
    // Ignore synchronous browser errors for the same reason.
  }
}
