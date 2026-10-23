import { useMemo } from "react";
import { Download as DownloadIcon, Apple, ExternalLink, MonitorSmartphone } from "lucide-react";
import Reveal from "./Reveal";
import { useReleases } from "@/lib/useReleases";
import {
  RELEASES_URL,
  LATEST_RELEASE_URL,
  ISSUES_URL,
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
    detected === "unknown"
      ? undefined
      : findAsset(assets, detected);

  const windows = findAsset(assets, "windows");
  const macArm = findAsset(assets, "macos-arm");
  const macIntel = findAsset(assets, "macos-intel");
  const linux = findAsset(assets, "linux");

  const primaryDownload = primaryAsset;
  const primaryLabel = loading
    ? "Checking for the latest release…"
    : primaryDownload
      ? `Download ${detected === "unknown" ? "Origin" : `for ${platformLabels[detected]}`}`
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
              href={primaryDownload?.asset.browser_download_url ?? RELEASES_URL}
              target={primaryDownload ? undefined : "_blank"}
              rel={primaryDownload ? undefined : "noreferrer noopener"}
              aria-disabled={loading}
              className="flex w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-strong sm:w-auto"
            >
              <DownloadIcon size={17} aria-hidden="true" />
              {primaryLabel}
            </a>
            {latest && (
              <p className="text-xs text-tertiary">
                Version {latest.tag_name.replace(/^v/, "")}
                {!primaryDownload && !loading && " — see all platforms below"}
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
              unavailableLabel={status === "error" ? "Release info unavailable" : undefined}
            />
            <PlatformCard
              icon={Apple}
              name="macOS"
              asset={macArm ?? macIntel}
              secondaryAsset={macIntel}
              primaryLabel={macArm ? "Apple Silicon" : "Intel"}
              secondaryLabel="Intel"
              loading={loading}
              unavailableLabel={status === "error" ? "Release info unavailable" : undefined}
            />
            <PlatformCard
              icon={MonitorSmartphone}
              name="Linux"
              asset={linux}
              loading={loading}
              unavailableLabel={status === "error" ? "Release info unavailable" : undefined}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-sm text-tertiary">
            Prefer to build from source, or want to inspect a release before installing?{" "}
            <a
              href={LATEST_RELEASE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-accent hover:underline"
            >
              View the latest release on GitHub
              <ExternalLink size={13} aria-hidden="true" />
            </a>
            {latest && (
              <a
                href={latest.html_url}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-accent hover:underline"
              >
                Release notes
                <ExternalLink className="ml-1 inline" size={13} aria-hidden="true" />
              </a>
            )}
          </div>

          <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-border-subtle bg-surface p-5 text-sm leading-relaxed text-secondary">
            <p className="font-medium text-primary">About macOS security warnings</p>
            <p className="mt-2">
              These macOS builds are distributed outside Apple&apos;s normal Developer ID signing
              and notarization process, so macOS may show a security warning. The current desktop
              release workflow does not confirm Apple notarization or an Apple-verified app. If a
              release is ad-hoc signed, that does not guarantee installation or make it notarized.
            </p>
            <p className="mt-2">
              <a href="#macos-install" className="font-medium text-accent hover:underline">
                Read the macOS installation guide
              </a>
            </p>
          </div>
        </Reveal>

        <MacOSInstallGuide />
      </div>
    </section>
  );
}

function MacOSInstallGuide() {
  return (
    <Reveal delay={140} className="mx-auto mt-20 max-w-3xl">
      <div id="macos-install" className="border-t border-border-subtle pt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">macOS guide</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
          Install Origin on your Mac.
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          Use the build that matches your Mac: Apple Silicon for M-series Macs, or Intel for Macs
          with an Intel processor.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            ["Download", "Download the correct Origin build for your Mac from the release list above."],
            ["Extract", "If you downloaded an archive, open it to extract Origin.app."],
            ["Move", "Drag Origin.app into your Applications folder."],
            ["Open", "Open Origin normally from Applications or Launchpad."],
            ["Allow", "If macOS blocks it and offers an override, open System Settings → Privacy & Security and look for Open Anyway."],
            ["Retry", "If Origin still reports that it is damaged, download a fresh copy and contact support or report an issue."],
          ].map(([title, body], index) => (
            <li key={title} className="rounded-xl border border-border-subtle bg-surface p-5">
              <span className="font-mono text-xs text-accent">0{index + 1}</span>
              <h4 className="mt-2 text-sm font-semibold text-primary">{title}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-xl border border-warning/30 bg-warning/8 p-5 text-sm leading-relaxed text-secondary">
          <p>
            The Open Anyway option is not available for every type of security failure. On some
            macOS versions, or for some warnings, you may be able to right-click (or Control-click)
            Origin.app and choose Open once, then confirm the prompt. The available options depend
            on your macOS version and the specific security warning. Do not assume this workflow
            will always appear.
          </p>
          <p className="mt-3">
            Origin is not presented as notarized or Apple-approved. The release workflow publishes
            macOS builds for both architectures, but does not confirm Apple Developer ID signing
            or notarization. Ad-hoc signing should only be described for releases whose workflow
            explicitly confirms it.
          </p>
          <p className="mt-3">
            Still blocked? <a href={ISSUES_URL} target="_blank" rel="noreferrer noopener" className="font-medium text-accent hover:underline">Report an issue</a> with the exact warning and artifact filename.
          </p>
        </div>
      </div>
    </Reveal>
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
  unavailableLabel,
}: {
  icon: typeof MonitorSmartphone;
  name: string;
  asset?: PlatformAsset;
  secondaryAsset?: PlatformAsset;
  primaryLabel?: string;
  secondaryLabel?: string;
  loading: boolean;
  unavailableLabel?: string;
}) {
  const available = !!asset && !loading;

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
          {unavailableLabel ?? "Unavailable in this release"}
        </span>
      )}
    </div>
  );
}
