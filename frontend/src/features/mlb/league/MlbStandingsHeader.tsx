export type MlbStandingsView = "division" | "conference";

type MlbStandingsHeaderProps = {
  season: number;
  view: MlbStandingsView;
  onViewChange: (view: MlbStandingsView) => void;
};

const VIEW_TABS: { id: MlbStandingsView; label: string }[] = [
  { id: "division", label: "Division" },
  { id: "conference", label: "Conference" },
];

export function MlbStandingsHeader({
  season,
  view,
  onViewChange,
}: MlbStandingsHeaderProps) {
  return (
    <div data-testid="mlb-standings-header" className="relative z-20 space-y-3">
      <h1 className="text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
        MLB {season} Standings
      </h1>

      <div
        role="tablist"
        aria-label="Standings view"
        className="flex items-center justify-center gap-1 border-b border-white/10"
      >
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`mlb-standings-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            aria-controls={`mlb-standings-${tab.id}-panel`}
            className={`border-b-2 px-5 py-2 text-[18px] font-medium transition-colors ${
              view === tab.id
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
            onClick={() => onViewChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
