import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CHROME_PAGE_X } from "@/app/layouts/chrome";
import { useWnbaProps } from "@/features/basketball/hooks/useWnbaProps";
import { useWnbaScoreboard } from "@/features/basketball/hooks/useWnbaScoreboard";
import { WnbaPropPicksFilters } from "@/features/basketball/league/WnbaPropPicksFilters";
import {
  appFromSearch,
  WnbaPropPicksHeader,
  type WnbaPropAppTab,
} from "@/features/basketball/league/WnbaPropPicksHeader";
import { WnbaPropPicksList } from "@/features/basketball/league/WnbaPropPicksList";
import {
  collectWnbaTeamOptions,
  excludePastGameProps,
  filterWnbaPropPlayers,
} from "@/features/basketball/league/filterWnbaPropPicks";
import { groupWnbaPropPlayers } from "@/features/basketball/league/groupWnbaPropPlayers";

/** Board always fetches 4-pick Power (PP) / Standard (UD); UI no longer exposes legs. */
const BOARD_LEGS = 4;

function formatForApp(app: WnbaPropAppTab): string {
  return app === "underdog" ? "standard" : "power";
}

function appLabel(app: WnbaPropAppTab): string {
  return app === "underdog" ? "Underdog" : "PrizePicks";
}

export function LeaguePropPicksPage() {
  const [params, setSearchParams] = useSearchParams();
  const app = appFromSearch(params.get("app"));
  const format = formatForApp(app);

  const { data, isLoading, isError, isFetched, dataUpdatedAt } = useWnbaProps({
    app,
    format,
    legs: BOARD_LEGS,
  });
  const { games, data: scoreboard } = useWnbaScoreboard();

  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(
    () => new Set(),
  );
  const [query, setQuery] = useState("");

  const props = data?.props ?? [];
  const activeProps = useMemo(
    () => excludePastGameProps(props, games, scoreboard?.date),
    [props, games, scoreboard?.date],
  );
  const showLoading = isLoading && !isFetched;
  const showError = isError && !data;
  const apiEmpty = showError || Boolean(data && props.length === 0);

  const filtersActive = selectedTeams.size > 0 || query.trim().length > 0;

  const players = useMemo(
    () => groupWnbaPropPlayers(activeProps),
    [activeProps],
  );
  const filtered = useMemo(
    () =>
      filterWnbaPropPlayers(players, {
        teams: selectedTeams,
        query,
      }),
    [players, selectedTeams, query],
  );

  function clearFilters() {
    setSelectedTeams(new Set());
    setQuery("");
  }

  function onAppChange(next: WnbaPropAppTab) {
    setSearchParams({ app: next }, { replace: true });
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
      <section className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X}`}>
        <WnbaPropPicksHeader
          activeApp={app}
          onAppChange={onAppChange}
        >
          {showBoardFilters ? (
            <WnbaPropPicksFilters
              tone="pill"
              teams={collectWnbaTeamOptions(activeProps)}
              selectedTeams={selectedTeams}
              query={query}
              onTeamsChange={setSelectedTeams}
              onQueryChange={setQuery}
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
            players={filtered}
            app={app}
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
