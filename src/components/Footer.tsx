import { Github } from "lucide-react";
import { REPO_URL } from "@/lib/github";

const links = [
  { label: "GitHub", href: REPO_URL, external: true },
  { label: "Download", href: "#download" },
  { label: "Changelog", href: "#changelog" },
  { label: "Mac install", href: "#macos-install" },
  { label: "FAQ", href: "#faq" },
  { label: "Feedback", href: "/feedback" },
];

export default function Footer() {
  const isFeedbackPage = window.location.pathname === "/feedback";
  return (
    <footer className="border-t border-border-subtle py-14">
      <div className="mx-auto flex max-w-[1320px] flex-col items-center gap-8 px-5 sm:flex-row sm:justify-between sm:px-8">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="" className="h-6 w-6 rounded-[6px]" width={24} height={24} />
            <span className="text-sm font-semibold tracking-tight text-primary">origin</span>
          </div>
          <p className="text-sm text-tertiary">Your code. One place.</p>
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href.startsWith("#") && isFeedbackPage ? `/${link.href}` : link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer noopener" : undefined}
                className="flex items-center gap-1.5 text-sm text-secondary transition-colors hover:text-primary"
              >
                {link.label === "GitHub" && <Github size={13} aria-hidden="true" />}
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <p className="text-xs text-tertiary">&copy; 2026 Origin</p>
      </div>
    </footer>
  );
}
