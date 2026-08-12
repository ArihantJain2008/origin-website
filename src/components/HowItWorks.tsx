import Reveal from "./Reveal";

const steps = [
  { number: "01", title: "Point Origin at your workspace." },
  { number: "02", title: "Origin detects your projects." },
  { number: "03", title: "Choose a project." },
  { number: "04", title: "Open it in your preferred editor." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            How it works.
          </h2>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Reveal key={step.number} delay={i * 80}>
              <div className="h-full rounded-xl border border-border-subtle bg-surface p-6">
                <span className="font-mono text-sm font-semibold text-accent">
                  {step.number}
                </span>
                <p className="mt-3 text-[15px] font-medium leading-snug text-primary">
                  {step.title}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
