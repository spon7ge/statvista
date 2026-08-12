import { useMemo, useState } from "react";
import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { useWnbaProps } from "@/features/basketball/hooks/useWnbaProps";
import { useWnbaScoreboard } from "@/features/basketball/hooks/useWnbaScoreboard";
import { WnbaPropPicksFilters } from "@/features/basketball/league/WnbaPropPicksFilters";
import {
  WnbaPropPicksHeader,
  type WnbaPropAppTab,
} from "@/features/basketball/league/WnbaPropPicksHeader";
import { WnbaPropPicksList } from "@/features/basketball/league/WnbaPropPicksList";
import {
  collectWnbaStatOptions,
  collectWnbaTeamOptions,
  excludePastGameProps,
  filterWnbaPropPicks,
} from "@/features/basketball/league/filterWnbaPropPicks";

function formatForApp(app: WnbaPropAppTab): string {
  return app === "underdog" ? "standard" : "power";
}

function appLabel(app: WnbaPropAppTab): string {
  return app === "underdog" ? "Underdog" : "PrizePicks";
}

export function LeaguePropPicksPage() {
  const [app, setApp] = useState<WnbaPropAppTab>("prizepicks");
  const [legs, setLegs] = useState<number>(4);
  const format = formatForApp(app);

  const { data, isLoading, isError, isFetched, dataUpdatedAt } = useWnbaProps({
    app,
    format,
    legs,
  });
  const { games, data: scoreboard } = useWnbaScoreboard();

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
  const activeProps = useMemo(
    () => excludePastGameProps(props, games, scoreboard?.date),
    [props, games, scoreboard?.date],
  );
  const showLoading = isLoading && !isFetched;
  const showError = isError && !data;
  const apiEmpty = showError || Boolean(data && props.length === 0);

  const filtersActive =
    selectedStats.size > 0 ||
    selectedTeams.size > 0 ||
    selectedSides.size > 0;

  const filtered = useMemo(
    () =>
      filterWnbaPropPicks(activeProps, {
        stats: selectedStats,
        teams: selectedTeams,
        sides: selectedSides,
      }),
    [activeProps, selectedStats, selectedTeams, selectedSides],
  );

  function clearFilters() {
    setSelectedStats(new Set());
    setSelectedTeams(new Set());
    setSelectedSides(new Set());
  }

  function onAppChange(next: WnbaPropAppTab) {
    setApp(next);
    clearFilters();
  }

  const showBoardFilters =
    !showLoading && !apiEmpty && activeProps.length > 0;
  const hidePastEmpty =
    !showError && !showLoading && props.length > 0 && activeProps.length === 0;

  let emptyMessage: string | undefined;
  if (apiEmpty && !showError) {
    emptyMessage = `No ${appLabel(app)} board available.`;
  } else if (hidePastEmpty) {
    emptyMessage = "No props for today's remaining games.";
  }

  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="wnba" />
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <WnbaPropPicksHeader
          activeApp={app}
          onAppChange={onAppChange}
          legs={legs}
          onLegsChange={setLegs}
        >
          {showBoardFilters ? (
            <WnbaPropPicksFilters
              tone="banner"
              stats={collectWnbaStatOptions(activeProps)}
              teams={collectWnbaTeamOptions(activeProps)}
              selectedStats={selectedStats}
              selectedTeams={selectedTeams}
              selectedSides={selectedSides}
              onStatsChange={setSelectedStats}
              onTeamsChange={setSelectedTeams}
              onSidesChange={setSelectedSides}
              onClear={clearFilters}
            />
          ) : null}
        </WnbaPropPicksHeader>

        <div
          id={`wnba-props-${app}-panel`}
          role="tabpanel"
          aria-labelledby={`wnba-props-${app}-tab`}
        >
          <WnbaPropPicksList
            props={filtered}
            format={format}
            legs={legs}
            breakevenPct={data?.breakeven_pct ?? null}
            isLoading={showLoading}
            isError={showError}
            filtersActive={
              filtersActive && !apiEmpty && activeProps.length > 0
            }
            emptyMessage={emptyMessage}
            lastUpdatedAt={dataUpdatedAt || undefined}
          />
        </div>
      </section>
    </div>
  );
}
