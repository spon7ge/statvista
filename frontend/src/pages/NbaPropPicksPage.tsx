import { useMemo, useState } from "react";
import { excludeStartedPropRows, usePregameNow } from "@/shared/lib/pregameProps";
import { useSearchParams } from "react-router-dom";
import { CHROME_PAGE_RIGHT, CHROME_PAGE_X } from "@/app/layouts/chrome";
import { useNbaPropBoard } from "@/features/nba/hooks/useNbaPropBoard";
import { NbaPropPicksFilters } from "@/features/nba/league/NbaPropPicksFilters";
import { NbaPropPicksHeader } from "@/features/nba/league/NbaPropPicksHeader";
import { NbaPropPicksTable } from "@/features/nba/league/NbaPropPicksTable";
import { bookDisplayName } from "@/features/basketball/lib/wnbaBookLabels";
import {
  collectNbaBoardGameOptions,
  collectNbaBoardPropositionOptions,
  filterNbaPropBoardRows,
  type NbaHitRateWindow,
  type NbaPropBoardSide,
} from "@/features/nba/league/filterNbaPropBoard";
import { BOOK_CHIP_ORDER } from "@/features/nba/league/sortNbaPropBoard";
import { collectBoardBookCountOptions } from "@/features/props/boardBookCount";

const BOOK_OPTIONS = BOOK_CHIP_ORDER.map((value) => ({
  value,
  label: bookDisplayName(value),
}));

export function NbaPropPicksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bookParam = searchParams.get("book");
  const book = bookParam ?? "prizepicks";
  const { data, isLoading, isError } = useNbaPropBoard(book);
  const [query, setQuery] = useState("");
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSides, setSelectedSides] = useState<Set<NbaPropBoardSide>>(
    () => new Set(),
  );
  const [selectedGames, setSelectedGames] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedBookCounts, setSelectedBookCounts] = useState<Set<string>>(
    () => new Set(),
  );
  const [hitRate, setHitRate] = useState<NbaHitRateWindow | null>(null);

  const now = usePregameNow();
  const rows = useMemo(
    () => excludeStartedPropRows(data?.rows ?? [], now),
    [data?.rows, now],
  );
  const markets = useMemo(() => collectNbaBoardPropositionOptions(rows), [rows]);
  const games = useMemo(() => collectNbaBoardGameOptions(rows), [rows]);
  const bookCounts = useMemo(() => collectBoardBookCountOptions(rows), [rows]);
  const filtered = useMemo(
    () =>
      filterNbaPropBoardRows(rows, {
        query,
        markets: selectedMarkets,
        sides: selectedSides,
        games: selectedGames,
        bookCounts: selectedBookCounts,
      }),
    [
      rows,
      query,
      selectedMarkets,
      selectedSides,
      selectedGames,
      selectedBookCounts,
    ],
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
    setSelectedBookCounts(new Set());
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
        <NbaPropPicksHeader>
          {showBoardFilters ? (
            <NbaPropPicksFilters
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
                      (side): side is NbaPropBoardSide =>
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
              bookCounts={bookCounts}
              selectedBookCounts={selectedBookCounts}
              onBookCountsChange={setSelectedBookCounts}
              hitRate={hitRate}
              onHitRateChange={setHitRate}
            />
          ) : null}
        </NbaPropPicksHeader>
        <NbaPropPicksTable
          rows={filtered}
          isLoading={isLoading}
          isError={showBoardError}
          hitRateWindow={hitRate}
        />
      </section>
    </div>
  );
}
