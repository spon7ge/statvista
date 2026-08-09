import { useMemo, useState } from "react";
import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { useMlbProps } from "@/features/mlb/hooks/useMlbProps";
import { MlbPropPicksFilters } from "@/features/mlb/league/MlbPropPicksFilters";
import {
  MlbPropPicksHeader,
  type MlbPropAppTab,
} from "@/features/mlb/league/MlbPropPicksHeader";
import { MlbPropPicksList } from "@/features/mlb/league/MlbPropPicksList";
import {
  collectMlbStatOptions,
  collectMlbTeamOptions,
  filterMlbPropPicks,
} from "@/features/mlb/league/filterMlbPropPicks";

function formatForApp(app: MlbPropAppTab): string {
  return app === "underdog" ? "standard" : "power";
}

function appLabel(app: MlbPropAppTab): string {
  return app === "underdog" ? "Underdog" : "PrizePicks";
}

export function MlbPropPicksPage() {
  const [app, setApp] = useState<MlbPropAppTab>("prizepicks");
  const [legs, setLegs] = useState<number>(4);
  const format = formatForApp(app);

  const { data, isLoading, isError, isFetched, dataUpdatedAt } = useMlbProps({
    app,
    format,
    legs,
  });

  const [selectedStats, setSelectedStats] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSides, setSelectedSides] = useState<Set<string>>(
    () => new Set(),
  );

  const props = data?.props ?? [];
  const showLoading = isLoading && !isFetched;
  const showError = isError && !data;
  const apiEmpty = showError || Boolean(data && props.length === 0);

  const filtersActive =
    selectedStats.size > 0 ||
    selectedTeams.size > 0 ||
    selectedSides.size > 0;

  const filtered = useMemo(
    () =>
      filterMlbPropPicks(props, {
        stats: selectedStats,
        teams: selectedTeams,
        sides: selectedSides,
      }),
    [props, selectedStats, selectedTeams, selectedSides],
  );

  function clearFilters() {
    setSelectedStats(new Set());
    setSelectedTeams(new Set());
    setSelectedSides(new Set());
  }

  function onAppChange(next: MlbPropAppTab) {
    setApp(next);
    clearFilters();
  }

  const showBoardFilters = !showLoading && !apiEmpty && props.length > 0;

  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="mlb" />
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <MlbPropPicksHeader
          activeApp={app}
          onAppChange={onAppChange}
          legs={legs}
          onLegsChange={setLegs}
        >
          {showBoardFilters ? (
            <MlbPropPicksFilters
              tone="banner"
              stats={collectMlbStatOptions(props)}
              teams={collectMlbTeamOptions(props)}
              selectedStats={selectedStats}
              selectedTeams={selectedTeams}
              selectedSides={selectedSides}
              onStatsChange={setSelectedStats}
              onTeamsChange={setSelectedTeams}
              onSidesChange={setSelectedSides}
              onClear={clearFilters}
            />
          ) : null}
        </MlbPropPicksHeader>

        <div
          id={`mlb-props-${app}-panel`}
          role="tabpanel"
          aria-labelledby={`mlb-props-${app}-tab`}
        >
          <MlbPropPicksList
            props={filtered}
            format={format}
            legs={legs}
            breakevenPct={data?.breakeven_pct ?? null}
            isLoading={showLoading}
            isError={showError}
            filtersActive={filtersActive && !apiEmpty && props.length > 0}
            emptyMessage={
              apiEmpty && !showError
                ? `No ${appLabel(app)} board available.`
                : undefined
            }
            lastUpdatedAt={dataUpdatedAt || undefined}
          />
        </div>
      </section>
    </div>
  );
}
