import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import Reveal from "./Reveal";
import { ISSUES_URL, RELEASES_URL } from "@/lib/github";

const faqs = [
  {
    q: "What is Origin?",
    a: "Origin is a developer workspace that organizes your coding projects, detects what they are, and launches them in your preferred editor.",
  },
  {
    q: "Is Origin an IDE?",
    a: "No. Origin is not an IDE. It sits above your existing workflow — it detects projects, remembers them, and hands off to the editor you already use.",
  },
  {
    q: "Which editors can I use?",
    a: "Origin currently supports VS Code, Cursor and Windsurf as preferred editors.",
  },
  {
    q: "Does Origin support projects without package.json?",
    a: "Yes. Project detection is intentionally broader than package.json — Origin recognizes structures like Cargo.toml, pom.xml, go.mod, .csproj and pyproject.toml, among others.",
  },
  {
    q: "Does Origin work with HTML/CSS/JavaScript projects?",
    a: "Yes. A project made up of index.html, style.css and script.js is recognized just like any other project structure.",
  },
  {
    q: "Does Origin replace VS Code?",
    a: "No. Origin doesn't replace your editor — it makes getting to your editor faster.",
  },
  {
    q: "Does Origin work offline?",
    a: "Origin's core project management, detection and launching run locally on your machine. An internet connection is only needed to check for and download updates.",
  },
  {
    q: "How does updating work?",
    a: "Origin can check for new releases and download and install them, so you don't have to manually track down a new installer each time.",
  },
  {
    q: "Is Origin free?",
    a: "Yes, Origin is free to download.",
  },
  {
    q: "Why does macOS say Origin is damaged and can't be opened?",
    a: (
      <>
        <p>
          This message does not always mean the files are physically damaged. It can be caused by
          signature validation, an incomplete download, incorrect packaging, quarantine, or other
          Gatekeeper restrictions.
        </p>
        <p className="mt-3">Try these safe checks:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Verify that the download came from the official <a className="text-accent hover:underline" href={RELEASES_URL}>Origin release page</a>.</li>
          <li>Download the artifact again if the first copy may be incomplete.</li>
          <li>Confirm that you selected the correct Mac architecture.</li>
          <li>Follow macOS&apos;s available security override instructions where appropriate.</li>
          <li><a className="text-accent hover:underline" href={ISSUES_URL}>Report the problem</a> if the error persists.</li>
        </ul>
        <p className="mt-3">
          Include your macOS version, Mac CPU architecture, Origin version, artifact filename, and
          the exact error message. Do not disable Gatekeeper globally or automatically remove
          quarantine attributes.
        </p>
      </>
    ) as ReactNode,
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            Frequently asked questions.
          </h2>
        </Reveal>

        <Reveal delay={80} className="mx-auto mt-12 max-w-2xl">
          <dl className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface">
            {faqs.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div key={faq.q}>
                  <dt>
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="text-[15px] font-medium text-primary">{faq.q}</span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-tertiary transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </dt>
                  <dd
                    className={`grid px-5 text-sm leading-relaxed text-secondary transition-all duration-300 ${
                      isOpen ? "grid-rows-[1fr] pb-4 opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                    style={{ display: "grid" }}
                  >
                    <div className="overflow-hidden">{faq.a}</div>
                  </dd>
                </div>
              );
            })}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
