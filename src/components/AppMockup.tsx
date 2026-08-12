import { Folder, House, Search, Settings, Star, GitBranch, ChevronDown } from "lucide-react";

const projects = [
  { name: "origin", lang: "Rust · TS", color: "#5b8def", branch: "main", fav: true },
  { name: "portfolio-site", lang: "Next.js", color: "#4fbf7b", branch: "main", fav: false },
  { name: "weather-cli", lang: "Go", color: "#7ea6f5", branch: "dev", fav: false },
  { name: "first-website", lang: "HTML · CSS · JS", color: "#e0a83e", branch: "main", fav: true },
  { name: "invoice-api", lang: ".NET", color: "#c98bd9", branch: "main", fav: false },
  { name: "ml-notebook", lang: "Python", color: "#5b8def", branch: "main", fav: false },
];

/**
 * A faithful, code-built mockup of Origin's real interface — sidebar
 * navigation, the preferred-editor switcher, and a project grid —
 * rather than an invented/unrelated dashboard. Mirrors the structure
 * of src/layouts/MainLayout.tsx and src/components/navigation/Sidebar.tsx
 * in the desktop app (Home / Projects / Settings, VS Code / Cursor /
 * Windsurf editor selection, project cards with language + git branch).
 */
export default function AppMockup({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative flex h-full w-full overflow-hidden rounded-2xl border border-border-default bg-surface shadow-[var(--shadow-modal)] ${className}`}
    >
      {/* Titlebar */}
      <div className="absolute inset-x-0 top-0 z-10 flex h-9 items-center gap-1.5 border-b border-border-subtle bg-surface px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5686b]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e0a83e]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4fbf7b]/70" />
        <span className="ml-3 text-[11px] font-medium text-tertiary">Origin</span>
      </div>

      <div className="flex w-full pt-9">
        {/* Sidebar */}
        <div className="hidden w-[168px] shrink-0 flex-col justify-between border-r border-border-subtle bg-elevated/60 px-2.5 py-3 sm:flex">
          <div className="flex flex-col gap-1">
            <div className="mb-2 flex items-center gap-2 px-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/20">
                <div className="h-2 w-2 rounded-full bg-accent" />
              </div>
              <span className="text-xs font-semibold tracking-tight text-primary">origin</span>
            </div>

            <SidebarItem icon={<House size={14} />} label="Home" />
            <SidebarItem icon={<Folder size={14} />} label="Projects" active />
            <SidebarItem icon={<Search size={14} />} label="Search" />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-2 py-1.5">
              <span className="text-[10px] font-medium text-secondary">VS Code</span>
              <ChevronDown size={11} className="text-tertiary" />
            </div>
            <SidebarItem icon={<Settings size={14} />} label="Settings" />
          </div>
        </div>

        {/* Main content: project grid */}
        <div className="flex-1 overflow-hidden bg-canvas px-4 py-3.5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-primary">Projects</span>
            <span className="text-[10px] text-tertiary">{projects.length} total</span>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.name}
                className="group flex flex-col gap-2 rounded-lg border border-border-subtle bg-elevated/70 p-2.5 transition-colors hover:border-border-default hover:bg-elevated"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-canvas"
                    style={{ backgroundColor: project.color }}
                  >
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  {project.fav && <Star size={11} className="fill-warning text-warning" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-primary">{project.name}</p>
                  <p className="truncate text-[9.5px] text-tertiary">{project.lang}</p>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-tertiary">
                  <GitBranch size={9} />
                  <span className="truncate">{project.branch}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ambient glow, restrained */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--color-accent)" }}
      />
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
        active ? "bg-accent-muted text-accent" : "text-secondary"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}
