import type { ApiMlbStandingsLeague } from "@/shared/lib/api";
import { buildMlbConferenceStandings } from "./buildMlbConferenceStandings";
import type { MlbStandingsView } from "./MlbStandingsHeader";
import { MlbStandingsDivisionCard } from "./MlbStandingsDivisionCard";

type MlbStandingsGridProps = {
  leagues: ApiMlbStandingsLeague[];
  view: MlbStandingsView;
  isLoading?: boolean;
  isError?: boolean;
};

function Skeletons({ count }: { count: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading standings"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          data-testid="standings-skeleton"
          className="h-72 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
        />
      ))}
    </div>
  );
}

function LeagueSection({
  title,
  divisions,
}: {
  title: string;
  divisions: ApiMlbStandingsLeague["divisions"];
}) {
  if (divisions.length === 0) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-semibold tracking-tight text-white">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {divisions.map((division) => (
          <MlbStandingsDivisionCard key={division.key} section={division} />
        ))}
      </div>
    </div>
  );
}

export function MlbStandingsGrid({
  leagues,
  view,
  isLoading = false,
  isError = false,
}: MlbStandingsGridProps) {
  const americanLeague = leagues.find((league) => league.key === "al");
  const nationalLeague = leagues.find((league) => league.key === "nl");
  const hasStandings =
    (americanLeague?.divisions.length ?? 0) > 0 ||
    (nationalLeague?.divisions.length ?? 0) > 0;

  return (
    <div className="space-y-10">
      {isLoading ? (
        <div className="space-y-10">
          <div className="space-y-4">
            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              American League
            </h2>
            <Skeletons count={3} />
          </div>
          <div className="space-y-4">
            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              National League
            </h2>
            <Skeletons count={3} />
          </div>
        </div>
      ) : isError ? (
        <p className="text-[14px] text-white/40">Standings unavailable</p>
      ) : !hasStandings ? (
        <p className="text-[14px] text-white/40">
          Standings not yet available for this season
        </p>
      ) : view === "conference" ? (
        <div
          id="mlb-standings-conference-panel"
          role="tabpanel"
          aria-labelledby="mlb-standings-conference-tab"
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          {buildMlbConferenceStandings(leagues).map((section) => (
            <MlbStandingsDivisionCard key={section.key} section={section} />
          ))}
        </div>
      ) : (
        <div
          id="mlb-standings-division-panel"
          role="tabpanel"
          aria-labelledby="mlb-standings-division-tab"
          className="space-y-10"
        >
          {americanLeague ? (
            <LeagueSection
              title={americanLeague.label}
              divisions={americanLeague.divisions}
            />
          ) : null}
          {nationalLeague ? (
            <LeagueSection
              title={nationalLeague.label}
              divisions={nationalLeague.divisions}
            />
          ) : null}
        </div>
      )}
      <p className="text-[14px] text-white/35">Data: statsapi.mlb.com</p>
    </div>
  );
}
