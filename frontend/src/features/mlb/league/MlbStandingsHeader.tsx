import crossedBatsMark from "@/assets/mlb-crossed-bats.png";

type MlbStandingsHeaderProps = {
  season: number;
};

/** Banner navy for MLB standings (distinct from Leaders orange). */
export const MLB_STANDINGS_BANNER_NAVY = "#0A2351";

/**
 * Scores-style banner for MLB standings (prop-picks layout, navy accent).
 */
export function MlbStandingsHeader({ season }: MlbStandingsHeaderProps) {
  return (
    <div data-testid="mlb-standings-header" className="relative z-20">
      <div
        className="relative overflow-hidden rounded-3xl px-5 py-5 sm:px-6 sm:py-6"
        style={{ backgroundColor: MLB_STANDINGS_BANNER_NAVY }}
      >
        <div className="relative z-10 flex min-h-[7.5rem] items-end justify-between gap-4">
          <div className="flex min-w-0 items-end gap-4 sm:gap-5">
            <img
              src={crossedBatsMark}
              alt=""
              role="presentation"
              className="h-20 w-auto shrink-0 self-center object-contain sm:h-24"
            />
            <h1 className="text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
              MLB {season} Standings
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
}
