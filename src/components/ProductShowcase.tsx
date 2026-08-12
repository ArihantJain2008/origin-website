import { FolderOpen, GitBranch, MonitorSmartphone } from "lucide-react";
import Reveal from "./Reveal";
import AppMockup from "./AppMockup";

const points = [
  {
    icon: FolderOpen,
    title: "Projects, not files",
    body: "Origin organizes your workspace by project — with metadata, favorites, and recents built in.",
  },
  {
    icon: GitBranch,
    title: "Git, at a glance",
    body: "Branch and repository status stay visible next to the project you're already looking at.",
  },
  {
    icon: MonitorSmartphone,
    title: "One workspace, every machine",
    body: "The same interface, the same shortcuts, on Windows, macOS and Linux.",
  },
];

export default function ProductShowcase() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            This is a real desktop application.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-secondary">
            Origin runs natively on your machine — not a browser tab, not a background service
            you forget about.
          </p>
        </Reveal>

        <Reveal delay={100} className="mx-auto mt-14 max-w-5xl">
          <div className="aspect-[16/9] w-full">
            <AppMockup />
          </div>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-3">
          {points.map((point, i) => (
            <Reveal key={point.title} delay={i * 80}>
              <div className="h-full rounded-xl border border-border-subtle bg-surface p-5">
                <point.icon size={18} className="text-accent" aria-hidden="true" />
                <h3 className="mt-3 text-[15px] font-semibold text-primary">{point.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-secondary">{point.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
