import { Check, X } from "lucide-react";
import Reveal from "./Reveal";

const originStructures = [
  { root: "index.html", children: ["style.css", "script.js"] },
  { root: "Cargo.toml", children: ["src/"] },
  { root: "pom.xml", children: ["src/"] },
  { root: "pyproject.toml", children: ["..."] },
];

export default function ProjectDetection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">
              Project detection
            </span>
            <h2 className="text-balance mt-3 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
              Start anywhere.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-secondary">
              Most developer launchers assume every project has a{" "}
              <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[0.9em] text-primary">
                package.json
              </code>
              . Origin does not.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-secondary">
              Whether your first project is three HTML files or a multi-language monorepo,
              Origin is designed to recognize the way you actually build.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border-subtle bg-surface p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-tertiary">
                  <X size={13} className="text-danger" aria-hidden="true" />
                  Traditional launchers
                </div>
                <pre className="overflow-x-auto rounded-lg bg-canvas p-3.5 font-mono text-[12.5px] leading-relaxed text-secondary">
{`project/
├── package.json
└── ...`}
                </pre>
              </div>

              <div className="rounded-xl border border-accent/30 bg-accent-muted p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-accent">
                  <Check size={13} aria-hidden="true" />
                  Origin
                </div>
                <div className="flex flex-col gap-2.5">
                  {originStructures.map((structure) => (
                    <pre
                      key={structure.root}
                      className="overflow-x-auto rounded-lg bg-canvas p-2.5 font-mono text-[11.5px] leading-relaxed text-secondary"
                    >
{`project/
├── ${structure.root}
${structure.children.map((c) => `└── ${c}`).join("\n")}`}
                    </pre>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
