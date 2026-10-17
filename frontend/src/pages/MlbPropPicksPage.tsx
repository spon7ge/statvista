import { useMemo, useState } from "react";
import { excludeStartedPropRows, usePregameNow } from "@/shared/lib/pregameProps";
import { useSearchParams } from "react-router-dom";
import { CHROME_PAGE_RIGHT, CHROME_PAGE_X } from "@/app/layouts/chrome";
import { useMlbPropBoard } from "@/features/mlb/hooks/useMlbPropBoard";
import { MlbPropPicksFilters } from "@/features/mlb/league/MlbPropPicksFilters";
import { MlbPropPicksHeader } from "@/features/mlb/league/MlbPropPicksHeader";
import { MlbPropPicksTable } from "@/features/mlb/league/MlbPropPicksTable";
import { bookDisplayName } from "@/features/mlb/lib/mlbBookLabels";
import {
  collectMlbBoardGameOptions,
  collectMlbBoardPropositionOptions,
  filterMlbPropBoardRows,
  type MlbHitRateWindow,
  type MlbPropBoardSide,
} from "@/features/mlb/league/filterMlbPropBoard";
import { BOOK_CHIP_ORDER } from "@/features/mlb/league/sortMlbPropBoard";

const BOOK_OPTIONS = BOOK_CHIP_ORDER.map((value) => ({
  value,
  label: bookDisplayName(value),
}));

export function MlbPropPicksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bookParam = searchParams.get("book");
  const book = bookParam ?? "prizepicks";
  const { data, isLoading, isError } = useMlbPropBoard(book);
  const [query, setQuery] = useState("");
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSides, setSelectedSides] = useState<Set<MlbPropBoardSide>>(
    () => new Set(),
  );
  const [selectedGames, setSelectedGames] = useState<Set<string>>(
    () => new Set(),
  );
  const [hitRate, setHitRate] = useState<MlbHitRateWindow | null>(null);

  const now = usePregameNow();
  const rows = useMemo(
    () => excludeStartedPropRows(data?.rows ?? [], now),
    [data?.rows, now],
  );
  const markets = useMemo(() => collectMlbBoardPropositionOptions(rows), [rows]);
  const games = useMemo(() => collectMlbBoardGameOptions(rows), [rows]);
  const filtered = useMemo(
    () =>
      filterMlbPropBoardRows(rows, {
        query,
        markets: selectedMarkets,
        sides: selectedSides,
        games: selectedGames,
      }),
    [rows, query, selectedMarkets, selectedSides, selectedGames],
  );

  function selectBook(next: Set<string>) {
    const chosen = [...next][0];
    const params = new URLSearchParams(searchParams);
    if (!chosen || chosen === "prizepicks") params.delete("book");
    else params.set("book", chosen);
    setSearchParams(params, { replace: true });
  }

  function clearFilters() {
    setQuery("");
    setSelectedMarkets(new Set());
    setSelectedSides(new Set());
    setSelectedGames(new Set());
    setHitRate(null);
    selectBook(new Set());
  }

  const showBoardError = isError && !data;
  const showBoardFilters = !isLoading && !showBoardError;

  return (
    <div className="space-y-0 pb-8">
      <section
        className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X} ${CHROME_PAGE_RIGHT}`}
      >
        <MlbPropPicksHeader>
          {showBoardFilters ? (
            <MlbPropPicksFilters
              tone="pill"
              query={query}
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
                      (side): side is MlbPropBoardSide =>
                        side === "over" || side === "under",
                    ),
                  ),
                )
              }
              books={BOOK_OPTIONS}
              selectedBooks={new Set([book])}
              onBooksChange={selectBook}
              games={games}
              selectedGames={selectedGames}
              onGamesChange={setSelectedGames}
              hitRate={hitRate}
              onHitRateChange={setHitRate}
            />
          ) : null}
        </MlbPropPicksHeader>
        <MlbPropPicksTable
          rows={filtered}
          isLoading={isLoading}
          isError={showBoardError}
          hitRateWindow={hitRate}
        />
      </section>
    </div>
  );
}
