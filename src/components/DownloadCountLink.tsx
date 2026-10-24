import { Download as DownloadIcon } from "lucide-react";

type DownloadCountLinkProps = {
  href: string;
  label: string;
  count: number | null;
  className: string;
  iconInDefaultState?: boolean;
  target?: string;
  rel?: string;
  ariaDisabled?: boolean;
  onClick?: () => void;
};

export default function DownloadCountLink({
  href,
  label,
  count,
  className,
  iconInDefaultState = false,
  target,
  rel,
  ariaDisabled,
  onClick,
}: DownloadCountLinkProps) {
  const hasCount = count !== null;
  const linkLabel = hasCount
    ? `${label}. ${count.toLocaleString()} unique visitors.`
    : label;

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      aria-disabled={ariaDisabled}
      aria-label={linkLabel}
      onClick={onClick}
      className={`group relative ${className}`}
    >
      <span aria-hidden="true" className="invisible inline-grid whitespace-nowrap">
        <span className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2">
          {iconInDefaultState && <DownloadIcon size={17} />}
          {label}
        </span>
        {hasCount && (
          <span className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5">
            <DownloadIcon size={15} />
            {count.toLocaleString()}
          </span>
        )}
      </span>
      <span
        className={`pointer-events-none absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap ${
          hasCount
            ? "motion-safe:transition-opacity motion-safe:duration-150 motion-reduce:transition-none [@media(hover:hover)]:group-hover:opacity-0 group-focus-visible:opacity-0"
            : ""
        }`}
      >
        {iconInDefaultState && <DownloadIcon size={17} aria-hidden="true" />}
        {label}
      </span>
      {hasCount && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 whitespace-nowrap opacity-0 motion-safe:transition-opacity motion-safe:duration-150 motion-reduce:transition-none [@media(hover:hover)]:group-hover:opacity-100 group-focus-visible:opacity-100">
          <DownloadIcon size={15} aria-hidden="true" />
          {count.toLocaleString()}
        </span>
      )}
    </a>
  );
}
