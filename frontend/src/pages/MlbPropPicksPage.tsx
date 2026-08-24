import { useMemo, useState } from "react";
import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { useMlbPropBoard } from "@/features/mlb/hooks/useMlbPropBoard";
import { MlbPropPicksFilters } from "@/features/mlb/league/MlbPropPicksFilters";
import { MlbPropPicksHeader } from "@/features/mlb/league/MlbPropPicksHeader";
import { MlbPropPicksTable } from "@/features/mlb/league/MlbPropPicksTable";
import { filterMlbPropBoardRows } from "@/features/mlb/league/filterMlbPropBoard";
import type { ApiMlbPropBoardRow } from "@/shared/lib/api";

function collectMlbBoardTeamOptions(rows: ApiMlbPropBoardRow[]): string[] {
  return [
    ...new Set(
      rows
        .map((row) => row.team_abbrev)
        .filter((abbrev): abbrev is string => Boolean(abbrev)),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function MlbPropPicksPage() {
  const { data, isLoading, isError, dataUpdatedAt } = useMlbPropBoard();
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(
    () => new Set(),
  );
  const [query, setQuery] = useState("");

  const rows = data?.rows ?? [];
  const filtered = useMemo(
    () => filterMlbPropBoardRows(rows, { teams: selectedTeams, query }),
    [rows, selectedTeams, query],
  );

  function clearFilters() {
    setSelectedTeams(new Set());
    setQuery("");
  }

  // React Query keeps `data` after a failed 15-minute refetch; only treat
  // error as empty-state on the first load when nothing is cached.
  const showBoardError = isError && !data;
  const showBoardFilters = !isLoading && !showBoardError && rows.length > 0;

  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="mlb" />
      <section className="mx-auto max-w-7xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <MlbPropPicksHeader>
          {showBoardFilters ? (
            <MlbPropPicksFilters
              tone="pill"
              teams={collectMlbBoardTeamOptions(rows)}
              selectedTeams={selectedTeams}
              query={query}
              onTeamsChange={setSelectedTeams}
              onQueryChange={setQuery}
              onClear={clearFilters}
            />
          ) : null}
        </MlbPropPicksHeader>
        <MlbPropPicksTable
          rows={filtered}
          isLoading={isLoading}
          isError={showBoardError}
          lastUpdatedAt={dataUpdatedAt || undefined}
        />
      </section>
    </div>
  );
}
