import { type ReactNode } from "react";

export const WNBA_PROP_PICKS_BANNER_EMERALD = "#059669";

export type WnbaPropAppTab = "prizepicks" | "underdog";

export function appFromSearch(value: string | null): WnbaPropAppTab {
  return value === "underdog" ? "underdog" : "prizepicks";
}

const APP_TABS: { id: WnbaPropAppTab; label: string }[] = [
  { id: "prizepicks", label: "PrizePicks" },
  { id: "underdog", label: "Underdog" },
];

type WnbaPropPicksHeaderProps = {
  activeApp: WnbaPropAppTab;
  onAppChange: (app: WnbaPropAppTab) => void;
  /** Optional board filters rendered as pills in the header row. */
  children?: ReactNode;
};

/**
 * Scores-style banner + PrizePicks / Underdog tabs (MLB twin).
 * Format/legs are fixed on the board (4-pick Power/Standard) so they stay off the chrome.
 */
export function WnbaPropPicksHeader({
  activeApp,
  onAppChange,
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
