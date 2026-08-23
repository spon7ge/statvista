import { type ReactNode } from "react";

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
  /** Team + search pills on the right of the title. */
  children?: ReactNode;
};

/**
 * WNBA Props (left) with Team / search pills (right) + PrizePicks / Underdog tabs.
 * Format/legs are fixed on the board (4-pick Power/Standard) so they stay off the chrome.
 */
export function WnbaPropPicksHeader({
  activeApp,
  onAppChange,
  children,
}: WnbaPropPicksHeaderProps) {
  return (
    <div data-testid="wnba-prop-picks-header" className="relative z-20 space-y-3">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <h1 className="min-w-0 shrink-0 text-left text-[28px] leading-none font-bold tracking-tight text-white sm:text-[32px]">
          WNBA Props
        </h1>
        {children ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {children}
          </div>
        ) : null}
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
