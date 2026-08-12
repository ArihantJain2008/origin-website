import Reveal from "./Reveal";

const platforms = [
  {
    name: "Windows",
    status: "Available",
    available: true,
    note: "Windows 10 and later",
  },
  {
    name: "macOS",
    status: "Available",
    available: true,
    note: "Apple Silicon and Intel",
  },
  {
    name: "Linux",
    status: "Coming soon",
    available: false,
    note: "Debian/Ubuntu and AppImage",
  },
];

export default function CrossPlatform() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            One workflow. Every machine.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-secondary">
            Origin is built as a native desktop application with Tauri. Windows and macOS
            builds are available today, with a Linux release on the roadmap.
          </p>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-3">
          {platforms.map((platform, i) => (
            <Reveal key={platform.name} delay={i * 80}>
              <div className="rounded-xl border border-border-subtle bg-surface p-6 text-center">
                <h3 className="text-lg font-semibold text-primary">{platform.name}</h3>
                <p className="mt-1 text-sm text-tertiary">{platform.note}</p>
                <span
                  className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    platform.available
                      ? "bg-success/12 text-success"
                      : "bg-warning/12 text-warning"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      platform.available ? "bg-success" : "bg-warning"
                    }`}
                  />
                  {platform.status}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
