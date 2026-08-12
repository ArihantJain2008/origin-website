import { useEffect, useState } from "react";
import { Github, Menu, X } from "lucide-react";
import { REPO_URL } from "@/lib/github";

const links = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Changelog", href: "#changelog" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass border-b border-border-subtle" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Origin home">
          <img src="/favicon.png" alt="" className="h-7 w-7 rounded-[7px]" width={28} height={28} />
          <span className="text-[15px] font-semibold tracking-tight text-primary">origin</span>
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-secondary transition-colors hover:text-primary"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 rounded-lg border border-border-default px-3.5 py-2 text-sm font-medium text-secondary transition-colors hover:border-border-default hover:bg-hover hover:text-primary"
          >
            <Github size={15} aria-hidden="true" />
            GitHub
          </a>
          <a
            href="#download"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_0_0_rgb(255_255_255/0.15)_inset] transition-colors hover:bg-accent-strong"
          >
            Download
          </a>
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-primary md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-border-subtle bg-canvas px-5 pb-6 pt-2 md:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2 py-3 text-[15px] text-secondary transition-colors hover:bg-hover hover:text-primary"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2.5">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-primary"
            >
              <Github size={16} aria-hidden="true" />
              GitHub
            </a>
            <a
              href="#download"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              Download Origin
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
