import {
  LayoutGrid,
  ScanSearch,
  ExternalLink,
  FolderTree,
  GitBranch,
  PictureInPicture2,
  PanelTopClose,
  RefreshCw,
} from "lucide-react";
import Reveal from "./Reveal";

const features = [
  {
    icon: LayoutGrid,
    title: "Project-first workspace",
    body: "Origin understands projects, not just files.",
  },
  {
    icon: ScanSearch,
    title: "Project detection",
    body: "Automatically recognize projects across different languages, frameworks and project structures.",
  },
  {
    icon: ExternalLink,
    title: "Editor launching",
    body: "Open projects directly in VS Code, Cursor, Windsurf or your preferred editor.",
  },
  {
    icon: FolderTree,
    title: "Folder browser",
    body: "Navigate your development folders without losing track of what is actually a project.",
  },
  {
    icon: GitBranch,
    title: "Git workflow",
    body: "Keep essential Git information close to the projects you work on.",
  },
  {
    icon: PictureInPicture2,
    title: "System overlay",
    body: "Access Origin quickly without interrupting your workflow.",
  },
  {
    icon: PanelTopClose,
    title: "System tray",
    body: "Keep Origin available in the background.",
  },
  {
    icon: RefreshCw,
    title: "Automatic updates",
    body: "Origin can detect new releases and update itself without requiring a full manual reinstall.",
  },
];

export default function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            Everything a developer workspace needs.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-secondary">
            Origin sits above your existing workflow — organizing what you already have.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 4) * 60} className="bg-surface">
              <div className="group h-full p-6 transition-colors hover:bg-elevated">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted">
                  <feature.icon size={17} className="text-accent" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-primary">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-secondary">{feature.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
