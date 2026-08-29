import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { LeagueSectionSwitcher } from "@/features/home/LeagueSectionSwitcher";

/**
 * Games title + horizontal league pills (same chrome as Props).
 * Date nav stays on the slate panel under this header.
 */
export function MatchupsHeader() {
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
      <LeagueSectionSwitcher section="Games" />
    </div>
  );
}
