import crossedBatsMark from "@/assets/mlb-crossed-bats.png";

export type MlbStandingsView = "division" | "conference";

type MlbStandingsHeaderProps = {
  season: number;
  view: MlbStandingsView;
  onViewChange: (view: MlbStandingsView) => void;
};

/** Banner navy for MLB standings (distinct from Leaders orange). */
export const MLB_STANDINGS_BANNER_NAVY = "#0A2351";

const VIEW_TABS: { id: MlbStandingsView; label: string }[] = [
  { id: "division", label: "Division" },
  { id: "conference", label: "Conference" },
];

/**
 * Scores-style banner for MLB standings (prop-picks layout, navy accent).
 */
export function MlbStandingsHeader({
  season,
  view,
  onViewChange,
}: MlbStandingsHeaderProps) {
  return (
    <div data-testid="mlb-standings-header" className="relative z-20 space-y-3">
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
