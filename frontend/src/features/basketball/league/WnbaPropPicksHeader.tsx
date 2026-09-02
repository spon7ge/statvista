import { type ReactNode } from "react";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { PropPicksLeagueSwitcher } from "@/features/home/PropPicksLeagueSwitcher";

export type WnbaPropAppTab = "prizepicks" | "underdog";

/** Shared by game-detail Props tabs; the research board no longer reads `?app=`. */
export function appFromSearch(value: string | null): WnbaPropAppTab {
  return value === "underdog" ? "underdog" : "prizepicks";
}

type WnbaPropPicksHeaderProps = {
  children?: ReactNode;
};

export function WnbaPropPicksHeader({ children }: WnbaPropPicksHeaderProps) {
  return (
    <div
      data-testid="wnba-prop-picks-header"
      className={`relative z-20 flex flex-col gap-4 ${CHROME_TITLE_TOP}`}
    >
      <div className="chrome-title-row">
        <h1 className="chrome-title">Props</h1>
      </div>
      <PropPicksLeagueSwitcher />
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
