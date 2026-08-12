import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import Reveal from "./Reveal";
import { useReleases } from "@/lib/useReleases";
import { formatDate, RELEASES_URL, type Release } from "@/lib/github";

interface ChangelogEntry {
  tag: string;
  date?: string;
  latest?: boolean;
  items: string[];
  url?: string;
}

// Static fallback, used only if the GitHub API is unreachable. Every
// line here is drawn directly from the repository's own release
// history (CHANGELOG.md and .github/workflows/release.yml) — nothing
// invented.
const fallbackReleases: ChangelogEntry[] = [
  {
    tag: "0.1.1",
    latest: true,
    items: [
      "Folder browser improvements",
      "Project detection improvements",
      "macOS support",
      "Performance improvements",
      "Bug fixes",
    ],
  },
  {
    tag: "0.1.0-alpha",
    items: ["React, TypeScript and Tauri application shell", "Initial navigation"],
  },
];

function parseBody(body: string | null): string[] {
  if (!body) return [];
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-") || line.startsWith("*"))
    .map((line) => line.replace(/^[-*]\s*/, ""))
    .filter(Boolean)
    .slice(0, 8);
}

export default function Changelog() {
  const { releases, status } = useReleases();

  const list = useMemo<ChangelogEntry[]>(() => {
    if (status === "ready" && releases.length > 0) {
      return releases.slice(0, 5).map((r: Release, i: number) => ({
        tag: r.tag_name.replace(/^v/, ""),
        date: formatDate(r.published_at),
        latest: i === 0,
        items: parseBody(r.body),
        url: r.html_url,
      }));
    }
    return fallbackReleases;
  }, [releases, status]);

  return (
    <section id="changelog" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            Changelog
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-secondary">
            What&apos;s shipped, straight from GitHub Releases.
          </p>
        </Reveal>

        <div className="mx-auto mt-14 max-w-2xl">
          <ol className="flex flex-col gap-6">
            {list.map((release, i) => (
              <Reveal key={release.tag} delay={i * 60} as="li">
                <div className="rounded-xl border border-border-subtle bg-surface p-6">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[15px] font-semibold text-primary">
                      {release.tag}
                    </span>
                    {release.latest && (
                      <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-[11px] font-medium text-accent">
                        Latest
                      </span>
                    )}
                    {release.date && (
                      <span className="text-xs text-tertiary">{release.date}</span>
                    )}
                  </div>

                  {release.items.length > 0 && (
                    <ul className="mt-3.5 flex flex-col gap-1.5">
                      {release.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-secondary">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-tertiary" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {release.url && (
                    <a
                      href={release.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                    >
                      View on GitHub
                      <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </Reveal>
            ))}
          </ol>

          <div className="mt-8 text-center">
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary"
            >
              All releases on GitHub
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
