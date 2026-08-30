import { CHROME_PAGE_X, CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { LeagueSectionSwitcher } from "@/features/home/LeagueSectionSwitcher";

/** Empty shell for cross-book arbitrage. */
export function LeagueArbitragePage() {
  return (
    <div className="space-y-0 pb-8">
      <section className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X}`}>
        <div
          data-testid="league-arbitrage-header"
          className={`relative z-20 flex flex-col gap-4 ${CHROME_TITLE_TOP}`}
        >
          <div className="flex min-h-7 items-center justify-between">
            <h1 className="text-left text-[28px] leading-none font-bold tracking-tight text-white">
              Arbitrage
            </h1>
          </div>
          <LeagueSectionSwitcher section="Arbitrage" />
        </div>
      </section>
    </div>
  );
}
