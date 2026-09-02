import { useLocation } from "react-router-dom";
import { CHROME_PAGE_X, CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { LeagueSectionSwitcher } from "@/features/home/LeagueSectionSwitcher";
import { useMlbLegs } from "@/features/mlb/hooks/useMlbLegs";
import { useWnbaLegs } from "@/features/basketball/hooks/useWnbaLegs";
import { LegsBoard } from "@/features/legs/LegsBoard";

export function LeagueLegsPage() {
  const { pathname } = useLocation();
  const isMlb = pathname.startsWith("/mlb");
  const isWnba = pathname.startsWith("/wnba");

  return (
    <div className="space-y-0 pb-8">
      <section className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X}`}>
        <div
          data-testid="league-legs-header"
          className={`relative z-20 flex flex-col gap-4 ${CHROME_TITLE_TOP}`}
        >
          <div className="chrome-title-row">
            <h1 className="chrome-title">Legs</h1>
          </div>
          <LeagueSectionSwitcher section="Legs" />
        </div>
        {isMlb ? <LegsBoard useLegs={useMlbLegs} /> : null}
        {isWnba ? <LegsBoard useLegs={useWnbaLegs} /> : null}
      </section>
    </div>
  );
}
