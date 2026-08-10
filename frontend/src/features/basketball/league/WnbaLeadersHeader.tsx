import basketballMark from "@/assets/wnba_basketball.png";

export const WNBA_LEADERS_BANNER_ORANGE = "#F38312";

export function WnbaLeadersHeader({ season }: { season: number }) {
  return (
    <div data-testid="wnba-leaders-header" className="relative z-20">
      <div
        className="relative overflow-hidden rounded-3xl px-5 py-5 sm:px-6 sm:py-6"
        style={{ backgroundColor: WNBA_LEADERS_BANNER_ORANGE }}
      >
        <div className="relative z-10 flex min-h-[7.5rem] items-end justify-between gap-4">
          <div className="flex min-w-0 items-end gap-4 sm:gap-5">
            <img
              src={basketballMark}
              alt=""
              role="presentation"
              className="h-20 w-auto shrink-0 self-center object-contain sm:h-24"
            />
            <h1 className="text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
              WNBA {season} Leaders
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
}
