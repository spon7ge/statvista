import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

function IconFrame({
  children,
  className,
  strokeWidth = 1.5,
  strokeLinecap = "butt",
  strokeLinejoin = "miter",
}: {
  children: ReactNode;
  className?: string;
  strokeWidth?: number;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Lucide stroke: round caps, weight 2 — used for the sidebar's restored shapes. */
function LucideFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <IconFrame
      className={className}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </IconFrame>
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

/** Layout list — Props (Lucide LayoutList). */
export function IconList({ className }: IconProps) {
  return (
    <LucideFrame className={className}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
      <path d="M14 4h7" />
      <path d="M14 9h7" />
      <path d="M14 15h7" />
      <path d="M14 20h7" />
    </LucideFrame>
  );
}

/** Stacked planes — Legs (Lucide Layers). */
export function IconLayers({ className }: IconProps) {
  return (
    <LucideFrame className={className}>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
    </LucideFrame>
  );
}

/** Opposing arrows — Arbitrage (Lucide ArrowLeftRight). */
export function IconSwap({ className }: IconProps) {
  return (
    <LucideFrame className={className}>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </LucideFrame>
  );
}

/** Date grid — Games (Lucide Calendar). */
export function IconCalendar({ className }: IconProps) {
  return (
    <LucideFrame className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </LucideFrame>
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

/** Info mark (Lucide Info). */
export function IconInfo({ className }: IconProps) {
  return (
    <LucideFrame className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </LucideFrame>
  );
}

/** Folded paper — Blog (Lucide Newspaper). */
export function IconNewspaper({ className }: IconProps) {
  return (
    <LucideFrame className={className}>
      <path d="M15 18h-5" />
      <path d="M18 14h-8" />
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" />
      <rect width="8" height="4" x="10" y="6" rx="1" />
    </LucideFrame>
  );
}

/** Settings cog (Lucide Settings). */
export function IconGear({ className }: IconProps) {
  return (
    <LucideFrame className={className}>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </LucideFrame>
  );
}
