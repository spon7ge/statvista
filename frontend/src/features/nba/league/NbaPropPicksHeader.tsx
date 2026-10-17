import { type ReactNode } from "react";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { PropPicksLeagueSwitcher } from "@/features/home/PropPicksLeagueSwitcher";

export type NbaPropAppTab = "prizepicks" | "underdog";

/** DFS app tab ids shared with prop helpers; research board no longer reads `?app=`. */
export function appFromSearch(value: string | null): NbaPropAppTab {
  return value === "underdog" ? "underdog" : "prizepicks";
}

type NbaPropPicksHeaderProps = {
  children?: ReactNode;
};

export function NbaPropPicksHeader({ children }: NbaPropPicksHeaderProps) {
  return (
    <div
      data-testid="nba-prop-picks-header"
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
