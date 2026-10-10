import { ExternalLink } from "lucide-react";
import Reveal from "./Reveal";
import { RELEASES_URL } from "@/lib/github";

interface ChangelogEntry {
  tag: string;
  categories: { name: string; items: string[] }[];
  url?: string;
}

// Consolidated by minor version from the Origin repository's tags,
// CHANGELOG.md, and v0.1.x release notes.
const fallbackReleases: ChangelogEntry[] = [
  {
    tag: "v1.0.0",
    categories: [{ name: "Released", items: [
      "Stable desktop release for Windows and macOS",
      "macOS Apple Silicon and Intel builds",
      "Signed updater artifacts published with the release",
    ] }],
    url: "https://github.com/ArihantJain2008/origin/releases/tag/v1.0.0",
  },
  {
    tag: "v0.5",
    categories: [{ name: "Added", items: [
      "TODO, dependency, README, health, and project statistics analyzers",
      "Analysis store, refresh analysis, and loading states",
    ] }, { name: "Improved", items: [
      "Project cards, empty states, dashboard, and project intelligence",
    ] }],
  },
  {
    tag: "v0.4",
    categories: [{ name: "Added", items: [
      "Dashboard foundation",
      "Continue Working, search, activity, and statistics",
    ] }],
  },
  {
    tag: "v0.3",
    categories: [{ name: "Added", items: [
      "SQLite persistence and project storage",
      "Favorites and recent projects",
    ] }],
  },
  {
    tag: "v0.2",
    categories: [{ name: "Added", items: [
      "Native project launcher",
      "Folder picker and framework detection",
      "Settings and Rust backend communication",
    ] }],
  },
  {
    tag: "v0.1",
    categories: [{ name: "Added", items: [
      "React, TypeScript, and Tauri application",
      "Application shell and navigation",
    ] }, { name: "Improved", items: [
      "Folder browser and project detection",
      "Performance and startup behavior",
    ] }, { name: "Fixed", items: ["Bug fixes"] }, { name: "Platform", items: ["macOS support"] }],
  },
];

export default function Changelog() {
  const list = fallbackReleases;

  return (
    <section id="changelog" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            Changelog
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-secondary">
            What&apos;s shipped across Origin&apos;s release history.
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
                  </div>

                  <div className="mt-3.5 flex flex-col gap-3">
                    {release.categories.map((category) => (
                      <div key={category.name}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-tertiary">
                          {category.name}
                        </h3>
                        <ul className="mt-1.5 flex flex-col gap-1.5">
                          {category.items.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm text-secondary">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-tertiary" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

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
