import { useState } from "react";
import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { WnbaPropPicksHeader } from "@/features/basketball/league/WnbaPropPicksHeader";
import { PropPicksFilters } from "@/features/basketball/league/PropPicksFilters";
import { PropPicksTable } from "@/features/basketball/league/PropPicksTable";
import {
  collectStatOptions,
  collectTeamOptions,
  excludePastGameProps,
  filterPropLines,
} from "@/features/basketball/league/filterPropLines";
import { useWnbaProps } from "@/features/basketball/hooks/useWnbaProps";
import { useWnbaScoreboard } from "@/features/basketball/hooks/useWnbaScoreboard";
import type { ApiWnbaPropLine } from "@/shared/lib/api";

export function LeaguePropPicksPage() {
  const { data, isLoading, isError, isFetched, dataUpdatedAt } = useWnbaProps({
    app: "prizepicks",
    format: "power",
    legs: 4,
  });
  const { games, data: scoreboard } = useWnbaScoreboard();
  // Temporary: board API returns ApiWnbaPropRow[]; leftover table still wants ApiWnbaPropLine (Tasks 8–9).
  const props = (data?.props ?? []) as unknown as ApiWnbaPropLine[];
  const activeProps = excludePastGameProps(props, games, scoreboard?.date);
  const showError = isError && !data;
  const showLoading = isLoading && !isFetched;
  const apiEmpty =
    showError || Boolean(data && props.length === 0 && data.error);

  const [selectedStats, setSelectedStats] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSides, setSelectedSides] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(
    () => new Set(["prizepicks", "underdog"]),
  );

  const filtersActive =
    selectedStats.size > 0 ||
    selectedSides.size > 0 ||
    selectedTeams.size > 0 ||
    selectedBooks.size > 0;

  const filtered = filterPropLines(activeProps, {
    stats: selectedStats,
    sides: selectedSides,
    teams: selectedTeams,
    books: selectedBooks,
  });

  return (
    <div className="space-y-0">
      <LeagueSubnav league="wnba" />
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <WnbaPropPicksHeader />
        <PropPicksTable
          props={filtered}
          isLoading={showLoading}
          isError={apiEmpty}
          visibleBooks={selectedBooks}
          lastUpdatedAt={dataUpdatedAt || undefined}
          filtersActive={filtersActive && !apiEmpty && activeProps.length > 0}
          toolbar={
            !showLoading && !apiEmpty && activeProps.length > 0 ? (
              <PropPicksFilters
                stats={collectStatOptions(activeProps)}
                teams={collectTeamOptions(activeProps)}
                selectedStats={selectedStats}
                selectedSides={selectedSides}
                selectedTeams={selectedTeams}
                selectedBooks={selectedBooks}
                onStatsChange={setSelectedStats}
                onSidesChange={setSelectedSides}
                onTeamsChange={setSelectedTeams}
                onBooksChange={setSelectedBooks}
                onClear={() => {
                  setSelectedStats(new Set());
                  setSelectedSides(new Set());
                  setSelectedTeams(new Set());
                  setSelectedBooks(new Set());
                }}
              />
            ) : null
          }
        />
      </section>
    </div>
  );
}
