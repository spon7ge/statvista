import type { ReactNode } from "react";

function StrokeIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      className="shrink-0"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
    >
      {children}
    </svg>
  );
}

export function GameInfoCalendarIcon() {
  return (
    <StrokeIcon>
      <path d="M4 6h16v14H4z" />
      <path d="M4 10h16" />
      <path d="M8 4v4" />
      <path d="M16 4v4" />
    </StrokeIcon>
  );
}

export function GameInfoVenueIcon() {
  return (
    <StrokeIcon>
      <path d="M4 20h16" />
      <path d="M4 10h16v4H4z" />
      <path d="M8 10v4" />
      <path d="M12 10v4" />
      <path d="M16 10v4" />
      <path d="M10 16h4v4h-4z" />
    </StrokeIcon>
  );
}

export function GameInfoCloudIcon() {
  return (
    <StrokeIcon>
      <path d="M8 16H6c-2 0-4-2-4-4s2-4 4-4c0-3 2-6 6-6s6 3 6 6h2c2 0 4 2 4 4s-2 4-4 4h-2" />
    </StrokeIcon>
  );
}

export function GameInfoWindIcon() {
  return (
    <StrokeIcon>
      <path d="M4 8h12" />
      <path d="M16 4v8" />
      <path d="M4 16h10" />
      <path d="M14 12v8" />
    </StrokeIcon>
  );
}

export function GameInfoOfficialsIcon() {
  return (
    <StrokeIcon>
      <path d="M8 8h8v4H8z" />
      <path d="M6 8H4v4l4 4v4h8v-4l4-4V8h-2" />
    </StrokeIcon>
  );
}

export function GameInfoBroadcastIcon() {
  return (
    <StrokeIcon>
      <path d="M4 8h12v8H4z" />
      <path d="M16 10l4-2v8l-4-2" />
    </StrokeIcon>
  );
}
