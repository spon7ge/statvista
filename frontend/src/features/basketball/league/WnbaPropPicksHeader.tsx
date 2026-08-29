import { type ReactNode } from "react";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { PropPicksLeagueSwitcher } from "@/features/home/PropPicksLeagueSwitcher";

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
  /** Team + search pills under the league switcher. */
  children?: ReactNode;
};

/**
 * Props title + league pills, then PrizePicks / Underdog tabs.
 * Format/legs are fixed on the board (4-pick Power/Standard) so they stay off the chrome.
 */
export function WnbaPropPicksHeader({
  activeApp,
  onAppChange,
  children,
}: WnbaPropPicksHeaderProps) {
  return (
    <div
      data-testid="wnba-prop-picks-header"
      className={`relative z-20 flex flex-col gap-4 ${CHROME_TITLE_TOP}`}
    >
      <div className="flex min-h-7 items-center justify-between">
        <h1 className="text-left text-[28px] leading-none font-bold tracking-tight text-white/70">
          Props
        </h1>
      </div>
      <PropPicksLeagueSwitcher />
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}

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
