import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CHROME_PAGE_RIGHT, CHROME_PAGE_X } from "@/app/layouts/chrome";
import { useWnbaPropBoard } from "@/features/basketball/hooks/useWnbaPropBoard";
import { WnbaPropPicksFilters } from "@/features/basketball/league/WnbaPropPicksFilters";
import { WnbaPropPicksHeader } from "@/features/basketball/league/WnbaPropPicksHeader";
import { WnbaPropPicksTable } from "@/features/basketball/league/WnbaPropPicksTable";
import { bookDisplayName } from "@/features/basketball/lib/wnbaBookLabels";
import {
  collectWnbaBoardGameOptions,
  collectWnbaBoardPropositionOptions,
  filterWnbaPropBoardRows,
  type WnbaHitRateWindow,
  type WnbaPropBoardSide,
} from "@/features/basketball/league/filterWnbaPropBoard";
import { BOOK_CHIP_ORDER } from "@/features/basketball/league/sortWnbaPropBoard";

const BOOK_OPTIONS = BOOK_CHIP_ORDER.map((value) => ({
  value,
  label: bookDisplayName(value),
}));

export function LeaguePropPicksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bookParam = searchParams.get("book");
  const book = bookParam ?? "prizepicks";
  const { data, isLoading, isError } = useWnbaPropBoard(book);
  const [query, setQuery] = useState("");
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSides, setSelectedSides] = useState<Set<WnbaPropBoardSide>>(
    () => new Set(),
  );
  const [selectedGames, setSelectedGames] = useState<Set<string>>(
    () => new Set(),
  );
  const [hitRate, setHitRate] = useState<WnbaHitRateWindow | null>(null);

  const rows = data?.rows ?? [];
  const markets = useMemo(() => collectWnbaBoardPropositionOptions(rows), [rows]);
  const games = useMemo(() => collectWnbaBoardGameOptions(rows), [rows]);
  const filtered = useMemo(
    () =>
      filterWnbaPropBoardRows(rows, {
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
        <WnbaPropPicksHeader>
          {showBoardFilters ? (
            <WnbaPropPicksFilters
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
                      (side): side is WnbaPropBoardSide =>
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
