type MlbLeadersHeaderProps = {
  season: number;
};

export function MlbLeadersHeader({ season }: MlbLeadersHeaderProps) {
  return (
    <div data-testid="mlb-leaders-header" className="relative z-20">
      <h1 className="text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
        MLB {season} Leaders
      </h1>
    </div>
  );
}
