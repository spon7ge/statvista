import type { ApiMlbPropBoardRow } from "@/shared/lib/api";
import { bookDisplayName } from "@/features/mlb/lib/mlbBookLabels";
import { BOOK_CHIP_ORDER } from "./sortMlbPropBoard";

export type MlbPropBoardSide = "over" | "under";
export type MlbHitRateWindow = "l5" | "l10" | "l15";

export type MlbPropBoardFilterSelection = {
  teams: Set<string>;
  query: string;
  markets?: Set<string>;
  sides?: Set<MlbPropBoardSide>;
  books?: Set<string>;
  games?: Set<string>;
};

export type MlbPropositionOption = { value: string; label: string };

const LINE_PREFIX = /^(Over|Under)\s+\d+(?:\.\d+)?\s+/i;

export function propositionLabelFromMarket(marketLabel: string, stat: string): string {
  const stripped = marketLabel.replace(LINE_PREFIX, "").trim();
  if (stripped) return stripped;
  return stat.replaceAll("_", " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function collectMlbBoardPropositionOptions(
  rows: ApiMlbPropBoardRow[],
): MlbPropositionOption[] {
  const byStat = new Map<string, string>();
  for (const row of rows) {
    if (!row.stat || byStat.has(row.stat)) continue;
    byStat.set(row.stat, propositionLabelFromMarket(row.market_label, row.stat));
  }
  return [...byStat.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function collectMlbBoardBookmakerOptions(
  rows: ApiMlbPropBoardRow[],
): MlbPropositionOption[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const chip of row.books) {
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

function formatMlbBoardMatchup(row: ApiMlbPropBoardRow): string | null {
  if (!row.team_abbrev || !row.opponent_abbrev) return null;
  return row.home_away === "home"
    ? `${row.opponent_abbrev} @ ${row.team_abbrev}`
    : `${row.team_abbrev} @ ${row.opponent_abbrev}`;
}

export function collectMlbBoardGameOptions(
  rows: ApiMlbPropBoardRow[],
): MlbPropositionOption[] {
  const byPk = new Map<
    string,
    { label: string; start: string | null }
  >();
  for (const row of rows) {
    if (row.game_pk == null) continue;
    const value = String(row.game_pk);
    if (byPk.has(value)) continue;
    const label = formatMlbBoardMatchup(row);
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
 * Rows with no posted American (empty Odds) are omitted; PrizePicks counts as posted.
 */
export function filterMlbPropBoardRows(
  rows: ApiMlbPropBoardRow[],
  { teams, query, markets, sides, books, games }: MlbPropBoardFilterSelection,
): ApiMlbPropBoardRow[] {
  const q = query.trim().toLowerCase();
  const marketFilter = markets ?? new Set<string>();
  const sideFilter = sides ?? new Set<MlbPropBoardSide>();
  const bookFilter = books ?? new Set<string>();
  const gameFilter = games ?? new Set<string>();
  return rows.flatMap((row) => {
    if (gameFilter.size > 0) {
      if (row.game_pk == null || !gameFilter.has(String(row.game_pk))) {
        return [];
      }
    }
    if (teams.size > 0 && (!row.team_abbrev || !teams.has(row.team_abbrev))) {
      return [];
    }
    if (q && !row.player_name.toLowerCase().includes(q)) return [];
    if (marketFilter.size > 0 && !marketFilter.has(row.stat)) return [];
    if (sideFilter.size > 0 && !sideFilter.has(row.side)) return [];
    const posted = row.books.filter(
      (chip) => chip.book === "prizepicks" || chip.american != null,
    );
    const visible =
      bookFilter.size > 0
        ? posted.filter((chip) => bookFilter.has(chip.book))
        : posted;
    if (visible.length === 0) return [];
    return [{ ...row, books: visible }];
  });
}
