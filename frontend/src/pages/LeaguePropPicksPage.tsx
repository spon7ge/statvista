import { useMemo, useState } from "react";
import { CHROME_PAGE_RIGHT, CHROME_PAGE_X } from "@/app/layouts/chrome";
import { useWnbaPropBoard } from "@/features/basketball/hooks/useWnbaPropBoard";
import { WnbaPropPicksFilters } from "@/features/basketball/league/WnbaPropPicksFilters";
import { WnbaPropPicksHeader } from "@/features/basketball/league/WnbaPropPicksHeader";
import { WnbaPropPicksTable } from "@/features/basketball/league/WnbaPropPicksTable";
import {
  collectWnbaBoardBookmakerOptions,
  collectWnbaBoardGameOptions,
  collectWnbaBoardPropositionOptions,
  filterWnbaPropBoardRows,
  type WnbaHitRateWindow,
  type WnbaPropBoardSide,
} from "@/features/basketball/league/filterWnbaPropBoard";
import type { ApiWnbaPropBoardRow } from "@/shared/lib/api";

function collectWnbaBoardTeamOptions(rows: ApiWnbaPropBoardRow[]): string[] {
  return [
    ...new Set(
      rows
        .map((row) => row.team_abbrev)
        .filter((abbrev): abbrev is string => Boolean(abbrev)),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function LeaguePropPicksPage() {
  const { data, isLoading, isError } = useWnbaPropBoard();
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(
    () => new Set(),
  );
  const [query, setQuery] = useState("");
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSides, setSelectedSides] = useState<Set<WnbaPropBoardSide>>(
    () => new Set(),
  );
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedGames, setSelectedGames] = useState<Set<string>>(
    () => new Set(),
  );
  const [hitRate, setHitRate] = useState<WnbaHitRateWindow | null>(null);

  const rows = data?.rows ?? [];
  const markets = useMemo(() => collectWnbaBoardPropositionOptions(rows), [rows]);
  const books = useMemo(() => collectWnbaBoardBookmakerOptions(rows), [rows]);
  const games = useMemo(() => collectWnbaBoardGameOptions(rows), [rows]);
  const filtered = useMemo(
    () =>
      filterWnbaPropBoardRows(rows, {
        teams: selectedTeams,
        query,
        markets: selectedMarkets,
        sides: selectedSides,
        books: selectedBooks,
        games: selectedGames,
      }),
    [
      rows,
      selectedTeams,
      query,
      selectedMarkets,
      selectedSides,
      selectedBooks,
      selectedGames,
    ],
  );

  function clearFilters() {
    setSelectedTeams(new Set());
    setQuery("");
    setSelectedMarkets(new Set());
    setSelectedSides(new Set());
    setSelectedBooks(new Set());
    setSelectedGames(new Set());
    setHitRate(null);
  }

  const showBoardError = isError && !data;
  const showBoardFilters = !isLoading && !showBoardError && rows.length > 0;

  return (
    <div className="space-y-0 pb-8">
      <section
        className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X} ${CHROME_PAGE_RIGHT}`}
      >
        <WnbaPropPicksHeader>
          {showBoardFilters ? (
            <WnbaPropPicksFilters
              tone="pill"
              teams={collectWnbaBoardTeamOptions(rows)}
              selectedTeams={selectedTeams}
              query={query}
              onTeamsChange={setSelectedTeams}
              onQueryChange={setQuery}
              onClear={clearFilters}
              markets={markets}
              selectedMarkets={selectedMarkets}
              onMarketsChange={setSelectedMarkets}
              selectedSides={selectedSides}
              onSidesChange={(next) =>
                setSelectedSides(
                  new Set(
                    [...next].filter(
                      (side): side is WnbaPropBoardSide =>
                        side === "over" || side === "under",
                    ),
                  ),
                )
              }
              books={books}
              selectedBooks={selectedBooks}
              onBooksChange={setSelectedBooks}
              games={games}
              selectedGames={selectedGames}
              onGamesChange={setSelectedGames}
              hitRate={hitRate}
              onHitRateChange={setHitRate}
            />
          ) : null}
        </WnbaPropPicksHeader>
        <WnbaPropPicksTable
          rows={filtered}
          isLoading={isLoading}
          isError={showBoardError}
          hitRateWindow={hitRate}
        />
      </section>
    </div>
  );
}
