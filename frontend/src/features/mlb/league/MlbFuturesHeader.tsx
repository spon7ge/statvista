type MlbFuturesHeaderProps = {
  season: number;
};

export function MlbFuturesHeader({ season }: MlbFuturesHeaderProps) {
  return (
    <div data-testid="mlb-futures-header" className="relative z-20">
      <h1 className="text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
        MLB {season} Futures
      </h1>
    </div>
  );
}
