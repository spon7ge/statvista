import { type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const WNBA_PROP_PICKS_BANNER_EMERALD = "#059669";

export type WnbaPropAppTab = "prizepicks" | "underdog";

const APP_TABS: { id: WnbaPropAppTab; label: string }[] = [
  { id: "prizepicks", label: "PrizePicks" },
  { id: "underdog", label: "Underdog" },
];

const LEGS_OPTIONS = [2, 3, 4, 5, 6] as const;

const PILL_CLASS =
  "inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-emerald-800 shadow-sm";

type WnbaPropPicksHeaderProps = {
  activeApp: WnbaPropAppTab;
  onAppChange: (app: WnbaPropAppTab) => void;
  legs: number;
  onLegsChange: (legs: number) => void;
  /** Optional board filters rendered as pills in the header row. */
  children?: ReactNode;
};

function LegsPill({
  legs,
  onLegsChange,
}: {
  legs: number;
  onLegsChange: (legs: number) => void;
}) {
  const idx = Math.max(
    0,
    LEGS_OPTIONS.indexOf(legs as (typeof LEGS_OPTIONS)[number]),
  );
  const atStart = idx <= 0;
  const atEnd = idx >= LEGS_OPTIONS.length - 1;

  return (
    <div className={PILL_CLASS} role="group" aria-label="Legs">
      <button
        type="button"
        aria-label="Fewer legs"
        disabled={atStart}
        className="rounded-full p-0.5 text-emerald-800 disabled:opacity-30"
        onClick={() => {
          if (!atStart) onLegsChange(LEGS_OPTIONS[idx - 1]);
        }}
      >
        <ChevronLeft className="size-4" aria-hidden strokeWidth={2} />
      </button>
      <span className="min-w-[3.5rem] text-center tabular-nums">{legs}-pick</span>
      <button
        type="button"
        aria-label="More legs"
        disabled={atEnd}
        className="rounded-full p-0.5 text-emerald-800 disabled:opacity-30"
        onClick={() => {
          if (!atEnd) onLegsChange(LEGS_OPTIONS[idx + 1]);
        }}
      >
        <ChevronRight className="size-4" aria-hidden strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Scores-style banner + PrizePicks / Underdog tabs (MLB twin).
 */
export function WnbaPropPicksHeader({
  activeApp,
  onAppChange,
  legs,
  onLegsChange,
  children,
}: WnbaPropPicksHeaderProps) {
  return (
    <div data-testid="wnba-prop-picks-header" className="relative z-20 space-y-3">
      <div
        className="relative rounded-3xl px-5 py-5 sm:px-6 sm:py-6"
        style={{ backgroundColor: WNBA_PROP_PICKS_BANNER_EMERALD }}
      >
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl bg-black/20"
          aria-hidden
        />
        <div className="relative z-10 flex min-h-[7.5rem] flex-col justify-between gap-6">
          <h1 className="min-w-0 text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
            WNBA Props
          </h1>

          <div className="relative z-30 flex flex-wrap items-center justify-end gap-2">
            {children}
            <LegsPill legs={legs} onLegsChange={onLegsChange} />
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="DFS app"
        className="flex items-center justify-center gap-1 border-b border-white/10"
      >
        {APP_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`wnba-props-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={activeApp === tab.id}
            aria-controls={`wnba-props-${tab.id}-panel`}
            className={`border-b-2 px-5 py-2 text-[18px] font-medium transition-colors ${
              activeApp === tab.id
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
            onClick={() => onAppChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
