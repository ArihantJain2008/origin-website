import { ArrowDown, FolderOpen, MousePointerClick, Code2 } from "lucide-react";
import Reveal from "./Reveal";

const steps = [
  { icon: FolderOpen, label: "Origin" },
  { icon: MousePointerClick, label: "Choose project" },
  { icon: Code2, label: "Preferred editor" },
];

const editors = ["VS Code", "Cursor", "Windsurf"];

export default function EditorWorkflow() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-border-subtle bg-surface p-8">
              {steps.map((step, i) => (
                <div key={step.label} className="flex w-full flex-col items-center">
                  <div className="flex w-full items-center gap-3 rounded-xl border border-border-default bg-elevated px-4 py-3">
                    <step.icon size={16} className="text-accent" aria-hidden="true" />
                    <span className="text-sm font-medium text-primary">{step.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowDown size={14} className="my-2 text-tertiary" aria-hidden="true" />
                  )}
                </div>
              ))}
              <ArrowDown size={14} className="my-2 text-tertiary" aria-hidden="true" />
              <div className="flex w-full flex-wrap justify-center gap-2">
                {editors.map((editor) => (
                  <span
                    key={editor}
                    className="rounded-full border border-border-default bg-canvas px-3 py-1.5 text-xs font-medium text-secondary"
                  >
                    {editor}
                  </span>
                ))}
              </div>
              <ArrowDown size={14} className="my-2 text-tertiary" aria-hidden="true" />
              <div className="rounded-xl bg-accent-muted px-4 py-3 text-sm font-medium text-accent">
                Start coding
              </div>
            </div>
          </Reveal>

          <Reveal delay={100} className="order-1 lg:order-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">
              Editor workflow
            </span>
            <h2 className="text-balance mt-3 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
              Origin doesn&apos;t replace your editor.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-secondary">
              It makes getting to your editor faster.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-secondary">
              Use the editor you already love. Origin finds the project, and hands it off to VS
              Code, Cursor or Windsurf — instantly.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
