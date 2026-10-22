const platformExtensions = {
  windows: /\.(exe|msi)$/i,
  "macos-arm": /\.(dmg|app\.tar\.gz)$/i,
  "macos-intel": /\.(dmg|app\.tar\.gz)$/i,
  linux: /\.(appimage|deb|rpm)$/i,
};

export function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isValidOfficialRelease(version, value) {
  try {
    const url = new URL(value);
    return /^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/.test(version)
      && url.protocol === "https:"
      && url.hostname === "github.com"
      && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === `/ArihantJain2008/origin/releases/tag/${encodeURIComponent(version)}`;
  } catch { return false; }
}

export function isValidOfficialAsset(version, asset) {
  if (!asset || typeof asset !== "object" || typeof asset.name !== "string" || asset.name.length > 255 || /[\\/\x00-\x1f]/.test(asset.name) || !asset.name.toLowerCase().startsWith("origin") || typeof asset.url !== "string" || !platformExtensions[asset.platform]?.test(asset.name)) return false;
  if (asset.size !== undefined && (!Number.isSafeInteger(asset.size) || asset.size < 0)) return false;
  try {
    const url = new URL(asset.url);
    return url.protocol === "https:"
      && url.hostname === "github.com"
      && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === `/ArihantJain2008/origin/releases/download/${encodeURIComponent(version)}/${encodeURIComponent(asset.name)}`;
  } catch { return false; }
}

export function isWholeInstallerTransfer(status, contentRange, bytes, contentLength) {
  if (Number.isFinite(contentLength) && bytes !== contentLength) return false;
  if (status !== 206) return status === 200;
  const match = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  return Boolean(match && Number(match[1]) === 0 && Number(match[2]) + 1 === Number(match[3]));
}

const trustedReleaseHosts = new Set(["github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"]);

export async function fetchOfficialInstaller(value, init, fetcher = fetch) {
  let target = new URL(value);
  if (target.hostname !== "github.com" || !target.pathname.startsWith("/ArihantJain2008/origin/releases/download/") || target.search || target.hash) {
    throw new Error("Installer URL is not an official release asset");
  }
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (target.protocol !== "https:" || target.username || target.password || target.port || target.hash || !trustedReleaseHosts.has(target.hostname)) {
      throw new Error("Installer redirect target is not trusted");
    }
    const response = await fetcher(target.href, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (redirects === 5) throw new Error("Installer redirect limit exceeded");
    const location = response.headers.get("location");
    if (!location) throw new Error("Installer redirect has no location");
    target = new URL(location, target);
  }
  throw new Error("Installer redirect limit exceeded");
}

export function waitForDrainOrClose(response, isClosed = () => false) {
  if (isClosed() || response.destroyed) return Promise.resolve(false);
  return new Promise((resolve) => {
    response.on("drain", () => resolve(true));
    response.on("close", () => resolve(Boolean(response.writableFinished)));
  });
}
