import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import Reveal from "./Reveal";

const stages = ["Checking", "Downloading", "Installing", "Restarting"] as const;

export default function UpdateSystem() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStageIndex((i) => (i + 1) % stages.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, []);

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
              Origin checks for new releases and can download and install updates without
              making you manually hunt for a new installer.
            </p>

            <ul className="mt-6 flex flex-wrap gap-2">
              {stages.map((stage, i) => (
                <li
                  key={stage}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    i === stageIndex
                      ? "border-accent/40 bg-accent-muted text-accent"
                      : "border-border-default text-tertiary"
                  }`}
                >
                  {stage}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={100} className="mx-auto w-full max-w-sm">
            <div className="rounded-2xl border border-border-default bg-elevated p-5 shadow-[var(--shadow-modal)]">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
                  <RefreshCw
                    size={16}
                    className={`text-accent ${stageIndex > 0 && stageIndex < 3 ? "animate-spin" : ""}`}
                    style={{ animationDuration: "2s" }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-primary">Update available</p>
                  <p className="mt-0.5 text-sm text-secondary">Origin 0.1.1 is available.</p>

                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-hover">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
                      style={{ width: `${((stageIndex + 1) / stages.length) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-tertiary">{stages[stageIndex]}&hellip;</p>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-secondary"
                    >
                      Later
                    </button>
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white"
                    >
                      <Download size={12} aria-hidden="true" />
                      Update Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
