import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

function IconFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** House — Home. */
export function IconHome({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M4 11L12 4l8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5h4v5" />
    </IconFrame>
  );
}

/** Three rules. */
export function IconMenu({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconFrame>
  );
}

/** Stacked rows — Props. */
export function IconList({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <path d="M4 6h2" />
      <path d="M4 12h2" />
      <path d="M4 18h2" />
    </IconFrame>
  );
}

/** Offset planes — Legs. */
export function IconLayers({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M4 8h12v8H4z" />
      <path d="M8 4h12v8" />
    </IconFrame>
  );
}

/** Opposing arrows — Arbitrage. */
export function IconSwap({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M4 8h12" />
      <path d="M12 4l4 4-4 4" />
      <path d="M20 16H8" />
      <path d="M12 12l-4 4 4 4" />
    </IconFrame>
  );
}

/** Date grid — Games. */
export function IconCalendar({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M4 6h16v14H4z" />
      <path d="M4 10h16" />
      <path d="M8 4v4" />
      <path d="M16 4v4" />
    </IconFrame>
  );
}

/** Down chevron; rotate for left/right/up. */
export function IconChevron({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M6 10l6 6 6-6" />
    </IconFrame>
  );
}

/** Right arrow. */
export function IconArrow({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M4 12h14" />
      <path d="M14 6l6 6-6 6" />
    </IconFrame>
  );
}

/** Box with outbound arrow. */
export function IconShare({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M4 10v10h12V10" />
      <path d="M12 14V4" />
      <path d="M8 8l4-4 4 4" />
    </IconFrame>
  );
}

/** Info mark. */
export function IconInfo({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v6" />
      <path d="M12 7v2" />
    </IconFrame>
  );
}

/** Settings cog, 8px-grid geometry. */
export function IconGear({ className }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M8 4h8v4h4v8h-4v4H8v-4H4V8h4z" />
      <path d="M8 8h8v8H8z" />
    </IconFrame>
  );
}
