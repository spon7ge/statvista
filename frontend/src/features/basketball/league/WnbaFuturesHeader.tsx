export function WnbaFuturesHeader({ season }: { season: number }) {
  return (
    <div data-testid="wnba-futures-header" className="relative z-20">
      <h1 className="text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
        WNBA {season} Futures
      </h1>
    </div>
  );
}
