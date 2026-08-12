export const WNBA_STANDINGS_BANNER_NAVY = "#0A2351";

export function WnbaStandingsHeader({ season }: { season: number }) {
  return (
    <div data-testid="wnba-standings-header" className="relative z-20">
      <div
        className="relative overflow-hidden rounded-3xl px-5 py-5 sm:px-6 sm:py-6"
        style={{ backgroundColor: WNBA_STANDINGS_BANNER_NAVY }}
      >
        <div className="relative z-10 flex min-h-[7.5rem] items-end justify-between gap-4">
          <h1 className="min-w-0 text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
            WNBA {season} Standings
          </h1>
        </div>
      </div>
    </div>
  );
}
