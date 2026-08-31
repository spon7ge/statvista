import { type ReactNode } from "react";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { LeagueSectionSwitcher } from "@/features/home/LeagueSectionSwitcher";

/**
 * Games title + league pills. Date nav sits on the same row as the pills.
 */
export function MatchupsHeader({ dateNav }: { dateNav?: ReactNode }) {
  return (
    <div
      data-testid="matchups-header"
      className={`relative z-20 flex flex-col gap-4 ${CHROME_TITLE_TOP}`}
    >
      <div className="flex min-h-7 items-center justify-between">
        <h1 className="text-left text-[28px] leading-none font-bold tracking-tight text-white">
          Games
        </h1>
      </div>
      <div className="flex items-center justify-between gap-4">
        <LeagueSectionSwitcher section="Games" />
        {dateNav}
      </div>
    </div>
  );
}
