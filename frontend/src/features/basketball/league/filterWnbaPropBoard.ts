import type { ApiWnbaPropBoardRow } from "@/shared/lib/api";
import { bookDisplayName } from "@/features/basketball/lib/wnbaBookLabels";
import { BOOK_CHIP_ORDER } from "./sortWnbaPropBoard";

export type WnbaPropBoardSide = "over" | "under";
export type WnbaHitRateWindow = "l5" | "l10" | "l15";

export type WnbaPropBoardFilterSelection = {
  teams: Set<string>;
  query: string;
  markets?: Set<string>;
  sides?: Set<WnbaPropBoardSide>;
  books?: Set<string>;
  games?: Set<string>;
};

export type WnbaPropositionOption = { value: string; label: string };

const LINE_PREFIX = /^(Over|Under)\s+\d+(?:\.\d+)?\s+/i;

export function propositionLabelFromMarket(marketLabel: string, stat: string): string {
  const stripped = marketLabel.replace(LINE_PREFIX, "").trim();
  if (stripped) return stripped;
  return stat.replaceAll("_", " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function collectWnbaBoardPropositionOptions(
  rows: ApiWnbaPropBoardRow[],
): WnbaPropositionOption[] {
  const byStat = new Map<string, string>();
  for (const row of rows) {
    if (!row.stat || byStat.has(row.stat)) continue;
    byStat.set(row.stat, propositionLabelFromMarket(row.market_label, row.stat));
  }
  return [...byStat.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function collectWnbaBoardBookmakerOptions(
  rows: ApiWnbaPropBoardRow[],
): WnbaPropositionOption[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const chip of [...(row.dfs ?? []), ...row.books]) {
      if (chip.book) seen.add(chip.book);
    }
  }
  const rank = new Map<string, number>(
    BOOK_CHIP_ORDER.map((book, index) => [book, index]),
  );
  return [...seen]
    .sort((a, b) => {
      const aRank = rank.get(a) ?? BOOK_CHIP_ORDER.length;
      const bRank = rank.get(b) ?? BOOK_CHIP_ORDER.length;
      if (aRank !== bRank) return aRank - bRank;
      return a.localeCompare(b);
    })
    .map((value) => ({ value, label: bookDisplayName(value) }));
}

function formatWnbaBoardMatchup(row: ApiWnbaPropBoardRow): string | null {
  if (!row.team_abbrev || !row.opponent_abbrev) return null;
  return row.home_away === "home"
    ? `${row.opponent_abbrev} @ ${row.team_abbrev}`
    : `${row.team_abbrev} @ ${row.opponent_abbrev}`;
}

export function collectWnbaBoardGameOptions(
  rows: ApiWnbaPropBoardRow[],
): WnbaPropositionOption[] {
  const byPk = new Map<
    string,
    { label: string; start: string | null }
  >();
  for (const row of rows) {
    if (row.game_id == null) continue;
    const value = String(row.game_id);
    if (byPk.has(value)) continue;
    const label = formatWnbaBoardMatchup(row);
    if (!label) continue;
    byPk.set(value, { label, start: row.game_start_at });
  }
  return [...byPk.entries()]
    .sort((a, b) => {
      const aStart = a[1].start;
      const bStart = b[1].start;
      if (aStart && bStart && aStart !== bStart) {
        return aStart.localeCompare(bStart);
      }
      if (aStart && !bStart) return -1;
      if (!aStart && bStart) return 1;
      return a[1].label.localeCompare(b[1].label);
    })
    .map(([value, { label }]) => ({ value, label }));
}

/**
 * Filters research-board rows by game, team, player name, market, side, and book.
 * Does not reorder (hit-rate highest→lowest is a sort on the table).
 * When books are selected, Odds chips are trimmed to those books.
 * Rows with no PrizePicks/Underdog line are omitted. PrizePicks counts as posted.
 * A sportsbook counts as posted when this side's American is set.
 * When books are selected, Odds/DFS chips are trimmed to those books.
 */
export function filterWnbaPropBoardRows(
  rows: ApiWnbaPropBoardRow[],
  { teams, query, markets, sides, books, games }: WnbaPropBoardFilterSelection,
): ApiWnbaPropBoardRow[] {
  const q = query.trim().toLowerCase();
  const marketFilter = markets ?? new Set<string>();
  const sideFilter = sides ?? new Set<WnbaPropBoardSide>();
  const bookFilter = books ?? new Set<string>();
  const gameFilter = games ?? new Set<string>();
  return rows.flatMap((row) => {
    if (gameFilter.size > 0) {
      if (row.game_id == null || !gameFilter.has(String(row.game_id))) {
        return [];
      }
    }
    if (teams.size > 0 && (!row.team_abbrev || !teams.has(row.team_abbrev))) {
      return [];
    }
    if (q && !row.player_name.toLowerCase().includes(q)) return [];
    if (marketFilter.size > 0 && !marketFilter.has(row.stat)) return [];
    if (sideFilter.size > 0 && !sideFilter.has(row.side)) return [];
    const dfs = row.dfs ?? [];
    const postedDfs = dfs.filter(
      (chip) => chip.book === "prizepicks" || chip.american != null,
    );
    if (postedDfs.length === 0) return [];
    const postedBooks = row.books.filter((chip) => chip.american != null);
    const visibleDfs =
      bookFilter.size > 0
        ? postedDfs.filter((chip) => bookFilter.has(chip.book))
        : postedDfs;
    const visibleBooks =
      bookFilter.size > 0
        ? postedBooks.filter((chip) => bookFilter.has(chip.book))
        : postedBooks;
    if (visibleDfs.length === 0 && visibleBooks.length === 0) return [];
    return [{ ...row, dfs: visibleDfs, books: visibleBooks }];
  });
}
