import { ArrowRight, Github } from "lucide-react";
import { REPO_URL } from "@/lib/github";
import AppMockup from "./AppMockup";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_10%,transparent_70%)]" />
      <div
        className="pointer-events-none absolute left-1/2 top-[-220px] h-[560px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]"
        style={{ background: "var(--color-accent)" }}
      />

      <div className="relative mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border-default bg-elevated/60 px-3.5 py-1.5 text-xs font-medium text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Available for Windows &amp; macOS
          </div>

          <h1 className="text-balance text-[44px] font-semibold leading-[1.05] tracking-tight text-primary sm:text-6xl">
            Your code.
            <br />
            One place.
          </h1>

          <p className="text-balance mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-secondary sm:text-lg">
            Origin is the developer workspace that organizes your projects, launches your
            editor, and keeps your coding workflow in one place.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#download"
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-[15px] font-semibold text-white transition-all hover:bg-accent-strong sm:w-auto"
            >
              Download Origin
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-default px-6 py-3 text-[15px] font-medium text-primary transition-colors hover:bg-hover sm:w-auto"
            >
              <Github size={16} aria-hidden="true" />
              View on GitHub
            </a>
          </div>

          <p className="mt-5 text-sm text-tertiary">
            Windows &middot; macOS &middot; Linux <span className="text-tertiary/70">(coming soon)</span>
          </p>
        </div>

        <div className="reveal is-visible mx-auto mt-16 max-w-4xl [perspective:1400px] sm:mt-20">
          <div className="aspect-[16/10] w-full [transform:rotateX(3deg)]">
            <AppMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
