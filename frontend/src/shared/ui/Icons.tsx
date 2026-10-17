import type { ReactNode } from "react";

type IconProps = {
  className?: string;
  "data-testid"?: string;
};

function IconFrame({
  children,
  className,
  "data-testid": dataTestId,
  strokeWidth = 1.5,
  strokeLinecap = "butt",
  strokeLinejoin = "miter",
}: {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
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
      data-testid={dataTestId}
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
export function IconChevron({ className, "data-testid": dataTestId }: IconProps) {
  return (
    <IconFrame className={className} data-testid={dataTestId}>
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

/** Envelope — Contact (Lucide Mail). */
export function IconMail({ className }: IconProps) {
  return (
    <LucideFrame className={className}>
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </LucideFrame>
  );
}
