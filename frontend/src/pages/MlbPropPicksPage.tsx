import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { useMlbProps } from "@/features/mlb/hooks/useMlbProps";
import { MlbPropPicksFilters } from "@/features/mlb/league/MlbPropPicksFilters";
import {
  appFromSearch,
  MlbPropPicksHeader,
  type MlbPropAppTab,
} from "@/features/mlb/league/MlbPropPicksHeader";
import { MlbPropPicksList } from "@/features/mlb/league/MlbPropPicksList";
import {
  collectMlbTeamOptions,
  filterMlbPropPlayers,
} from "@/features/mlb/league/filterMlbPropPicks";
import { groupMlbPropPlayers } from "@/features/mlb/league/groupMlbPropPlayers";

/** Board always fetches 4-pick Power (PP) / Standard (UD); UI no longer exposes legs. */
const BOARD_LEGS = 4;

function formatForApp(app: MlbPropAppTab): string {
  return app === "underdog" ? "standard" : "power";
}

function appLabel(app: MlbPropAppTab): string {
  return app === "underdog" ? "Underdog" : "PrizePicks";
}

export function MlbPropPicksPage() {
  const [params, setSearchParams] = useSearchParams();
  const app = appFromSearch(params.get("app"));
  const format = formatForApp(app);

  const { data, isLoading, isError, isFetched, dataUpdatedAt } = useMlbProps({
    app,
    format,
    legs: BOARD_LEGS,
  });

  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(
    () => new Set(),
  );
  const [query, setQuery] = useState("");

  const props = data?.props ?? [];
  const showLoading = isLoading && !isFetched;
  const showError = isError && !data;
  const apiEmpty = showError || Boolean(data && props.length === 0);

  const filtersActive = selectedTeams.size > 0 || query.trim().length > 0;

  const players = useMemo(() => groupMlbPropPlayers(props), [props]);
  const filtered = useMemo(
    () =>
      filterMlbPropPlayers(players, {
        teams: selectedTeams,
        query,
      }),
    [players, selectedTeams, query],
  );

  function clearFilters() {
    setSelectedTeams(new Set());
    setQuery("");
  }

  function onAppChange(next: MlbPropAppTab) {
    setSearchParams({ app: next }, { replace: true });
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
        >
          {showBoardFilters ? (
            <MlbPropPicksFilters
              tone="banner"
              teams={collectMlbTeamOptions(props)}
              selectedTeams={selectedTeams}
              query={query}
              onTeamsChange={setSelectedTeams}
              onQueryChange={setQuery}
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
            players={filtered}
            app={app}
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
