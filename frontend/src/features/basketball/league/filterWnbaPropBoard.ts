import type { ApiWnbaPropBoardRow } from "@/shared/lib/api";
import { rowMatchesBookCounts } from "@/features/props/boardBookCount";

export type WnbaPropBoardSide = "over" | "under";
export type WnbaHitRateWindow = "l5" | "l10" | "l15";

export type WnbaPropBoardFilterSelection = {
  query: string;
  markets?: Set<string>;
  sides?: Set<WnbaPropBoardSide>;
  games?: Set<string>;
  /** Exact book counts ("1", "2", …). Empty means every count. */
  bookCounts?: Set<string>;
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
 * Filters research-board rows by game, player name, market, side, and
 * how many books post the line. Does not reorder (hit-rate highest→lowest
 * is a sort on the table). The server already anchored the book and
 * matching odds chips.
 */
export function filterWnbaPropBoardRows(
  rows: ApiWnbaPropBoardRow[],
  {
    query,
    markets,
    sides,
    games,
    bookCounts,
  }: WnbaPropBoardFilterSelection,
): ApiWnbaPropBoardRow[] {
  const q = query.trim().toLowerCase();
  const marketFilter = markets ?? new Set<string>();
  const sideFilter = sides ?? new Set<WnbaPropBoardSide>();
  const gameFilter = games ?? new Set<string>();
  return rows.filter((row) => {
    if (gameFilter.size > 0) {
      if (row.game_id == null || !gameFilter.has(String(row.game_id))) {
        return false;
      }
    }
    if (q && !row.player_name.toLowerCase().includes(q)) return false;
    if (marketFilter.size > 0 && !marketFilter.has(row.stat)) return false;
    if (sideFilter.size > 0 && !sideFilter.has(row.side)) return false;
    if (!rowMatchesBookCounts(row, bookCounts)) return false;
    return true;
  });
}
