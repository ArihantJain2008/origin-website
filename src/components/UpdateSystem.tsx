import { ExternalLink, RefreshCw } from "lucide-react";
import Reveal from "./Reveal";
import { useReleases } from "@/lib/useReleases";
import { LATEST_RELEASE_URL } from "@/lib/github";

export default function UpdateSystem() {
  const { latest, status } = useReleases();
  const releaseStatus = status === "loading"
    ? "Checking release information..."
    : status === "error"
      ? "Update information unavailable."
      : latest
        ? `Latest published release: Origin ${latest.tag_name.replace(/^v/, "")}`
        : "Update information unavailable.";

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">
              Update system
            </span>
            <h2 className="text-balance mt-3 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
              Install once. Stay current.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-secondary">
              Origin checks its signed release manifest and only offers an update when a newer
              published release is available. The app does not claim an update is installing until
              the updater has actually downloaded and installed it.
            </p>
          </Reveal>

          <Reveal delay={100} className="mx-auto w-full max-w-sm">
            <div className="rounded-2xl border border-border-default bg-elevated p-5 shadow-[var(--shadow-modal)]">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
                  <RefreshCw size={16} className="text-accent" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-primary">Release status</p>
                  <p className="mt-0.5 text-sm text-secondary">{releaseStatus}</p>
                  {latest && (
                    <a
                      href={latest.html_url || LATEST_RELEASE_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                    >
                      View release notes
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
