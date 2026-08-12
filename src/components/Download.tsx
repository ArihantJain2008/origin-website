import { useMemo } from "react";
import { Download as DownloadIcon, Apple, MonitorSmartphone } from "lucide-react";
import Reveal from "./Reveal";
import { useReleases } from "@/lib/useReleases";
import {
  RELEASES_URL,
  LATEST_RELEASE_URL,
  detectPlatform,
  assetsByPlatform,
  type Platform,
  type PlatformAsset,
} from "@/lib/github";

const platformLabels: Record<Platform, string> = {
  windows: "Windows",
  "macos-arm": "macOS (Apple Silicon)",
  "macos-intel": "macOS (Intel)",
  linux: "Linux",
  unknown: "your platform",
};

function findAsset(assets: PlatformAsset[], platform: Platform) {
  return assets.find((a) => a.platform === platform);
}

export default function Download() {
  const { latest, status } = useReleases();
  const detected = useMemo(() => detectPlatform(), []);
  const assets = useMemo(() => assetsByPlatform(latest), [latest]);
  const loading = status === "loading";

  // Primary CTA: the asset matching the visitor's detected platform,
  // if the latest release actually shipped one. Never a guessed URL.
  const primaryAsset =
    detected === "unknown" ? undefined : findAsset(assets, detected);

  const windows = findAsset(assets, "windows");
  const macArm = findAsset(assets, "macos-arm");
  const macIntel = findAsset(assets, "macos-intel");
  const linux = findAsset(assets, "linux");

  const primaryLabel = loading
    ? "Checking for the latest release…"
    : primaryAsset
      ? `Download for ${platformLabels[detected]}`
      : "Download Origin";

  return (
    <section id="download" className="relative py-24 sm:py-32">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.14] blur-[110px]"
        style={{ background: "var(--color-accent)" }}
      />

      <div className="relative mx-auto max-w-[1320px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-5xl">
            Start with Origin.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-secondary">
            Free to download. Built for developers who want their projects in one place.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4">
            <a
              href={primaryAsset?.asset.browser_download_url ?? RELEASES_URL}
              target={primaryAsset ? undefined : "_blank"}
              rel={primaryAsset ? undefined : "noreferrer noopener"}
              aria-disabled={loading}
              className="flex w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-strong sm:w-auto"
            >
              <DownloadIcon size={17} aria-hidden="true" />
              {primaryLabel}
            </a>
            {latest && (
              <p className="text-xs text-tertiary">
                Version {latest.tag_name.replace(/^v/, "")}
                {!primaryAsset && !loading && " — see all platforms below"}
              </p>
            )}
          </div>
        </Reveal>

        <Reveal delay={100} className="mx-auto mt-14 max-w-3xl">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-tertiary">
            Other platforms
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <PlatformCard
              icon={MonitorSmartphone}
              name="Windows"
              asset={windows}
              loading={loading}
            />
            <PlatformCard
              icon={Apple}
              name="macOS"
              asset={macArm ?? macIntel}
              secondaryAsset={macArm && macIntel ? macIntel : undefined}
              secondaryLabel="Intel"
              primaryLabel={macArm ? "Apple Silicon" : undefined}
              loading={loading}
            />
            <PlatformCard
              icon={MonitorSmartphone}
              name="Linux"
              asset={linux}
              loading={loading}
              forceComingSoon
            />
          </div>

          <p className="mt-8 text-center text-sm text-tertiary">
            Prefer to build from source, or want to inspect a release before installing?{" "}
            <a
              href={LATEST_RELEASE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-accent hover:underline"
            >
              View the latest release on GitHub
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function PlatformCard({
  icon: Icon,
  name,
  asset,
  secondaryAsset,
  primaryLabel,
  secondaryLabel,
  loading,
  forceComingSoon = false,
}: {
  icon: typeof MonitorSmartphone;
  name: string;
  asset?: PlatformAsset;
  secondaryAsset?: PlatformAsset;
  primaryLabel?: string;
  secondaryLabel?: string;
  loading: boolean;
  forceComingSoon?: boolean;
}) {
  const available = !forceComingSoon && !!asset && !loading;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5 text-center">
      <Icon size={20} className="mx-auto text-secondary" aria-hidden="true" />
      <p className="mt-2.5 text-sm font-semibold text-primary">{name}</p>

      {loading ? (
        <p className="mt-3 text-xs text-tertiary">Checking&hellip;</p>
      ) : available ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <a
            href={asset!.asset.browser_download_url}
            className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-hover"
          >
            {primaryLabel ? `Download (${primaryLabel})` : "Download"}
          </a>
          {secondaryAsset && (
            <a
              href={secondaryAsset.asset.browser_download_url}
              className="text-xs font-medium text-accent hover:underline"
            >
              {secondaryLabel} version
            </a>
          )}
        </div>
      ) : (
        <span className="mt-3 inline-block rounded-full bg-hover px-3 py-1 text-xs font-medium text-tertiary">
          Coming soon
        </span>
      )}
    </div>
  );
}
