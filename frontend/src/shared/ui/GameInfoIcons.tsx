import type { ReactNode } from "react";

const ICON_CLASS = "size-[22px] shrink-0";

function StrokeIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 29.5 29.5"
      className={ICON_CLASS}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function GameInfoCalendarIcon() {
  return (
    <StrokeIcon>
      <rect x="3" y="3" width="23.5" height="23.5" />
      <line x1="3" y1="8" x2="26.5" y2="8" />
    </StrokeIcon>
  );
}

export function GameInfoVenueIcon() {
  return (
    <StrokeIcon>
      <path d="m3 24.5h23.5" />
      <path d="m3 10.1h23.5v5h-23.5z" />
      <path d="m3 15.1c1.2 2.2 1.8 6.2 1.8 9.3" />
      <path d="m26.5 15.1c-1.2 2.2-1.8 6.2-1.8 9.3" />
      <path d="m12.4 10.1v5" />
      <path d="m7.6 10.1v5" />
      <path d="m17.1 10.1v5" />
      <path d="m21.9 10.1v5" />
      <path d="m14.7 18.6c1.5 0 2.7 1.2 2.7 2.7v3.2h-5.3v-3.2c0-1.5 1.2-2.7 2.7-2.7z" />
      <path d="m10 10.1v-5.1" />
      <path d="m10 6.3h1.7" />
      <path d="m19.5 10.1v-5.1" />
      <path d="m19.5 6.3h1.8" />
    </StrokeIcon>
  );
}

export function GameInfoCloudIcon() {
  return (
    <StrokeIcon>
      <path d="m21.5 12.2c0-3.6-2.8-6.4-6.3-6.4-3.5 0-6.3 2.8-6.3 6.3v1.6h-1c-2.7 0-4.9 2.2-4.9 4.9s2.2 4.9 4.9 4.9h12.8c3.2 0 5.7-2.6 5.7-5.7s-2.2-5.3-4.9-5.7z" />
    </StrokeIcon>
  );
}

export function GameInfoWindIcon() {
  return (
    <StrokeIcon>
      <path d="m19.7 11.3c0-1.9 1.5-3.4 3.4-3.4s3.4 1.5 3.4 3.4-1.5 3.4-3.4 3.4h-20.1" />
      <path d="m15.7 22.1c0 1.9 1.5 3.4 3.4 3.4s3.4-1.5 3.4-3.4-1.5-3.4-3.4-3.4h-13.3" />
      <path d="m9.7 7.4c0-1.9 1.5-3.4 3.4-3.4s3.4 1.5 3.4 3.4-1.5 3.4-3.4 3.4h-7.3" />
    </StrokeIcon>
  );
}

export function GameInfoOfficialsIcon() {
  return (
    <svg
      viewBox="0 0 29.5 29.5"
      className={`${ICON_CLASS} mt-0.5`}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.9 9.3c-.5-3.5-3.5-6.3-7.2-6.3s-6.7 2.7-7.2 6.3" />
      <path d="m7.5 15.2c.5 3.5 3.5 6.3 7.2 6.3s6.7-2.7 7.2-6.3" />
      <path d="m7.4 9.3h14.5v6.3h-14.5z" />
      <path d="m7 9.3h-3.3v5l4.6 3.3 2.7 8.9h7.5l2.7-8.9 4.6-3.3v-5h-3.3" />
      <path d="m14.8 26.5v-5" />
    </svg>
  );
}

export function GameInfoBroadcastIcon() {
  return (
    <StrokeIcon>
      <rect x="3" y="8" width="18" height="13" rx="1.5" />
      <path d="M21 12.5 26.5 9v12L21 17.5" />
    </StrokeIcon>
  );
}
