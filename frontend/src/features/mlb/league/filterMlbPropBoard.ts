import type { ApiMlbPropBoardRow } from "@/shared/lib/api";

export type MlbPropBoardSide = "over" | "under";
export type MlbHitRateWindow = "l5" | "l10" | "l15";

export type MlbPropBoardFilterSelection = {
  teams: Set<string>;
  query: string;
  markets?: Set<string>;
  sides?: Set<MlbPropBoardSide>;
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

/**
 * Filters research-board rows by team, player name, market, and side.
 * Does not reorder (hit-rate highest→lowest is a sort on the table).
 */
export function filterMlbPropBoardRows(
  rows: ApiMlbPropBoardRow[],
  { teams, query, markets, sides }: MlbPropBoardFilterSelection,
): ApiMlbPropBoardRow[] {
  const q = query.trim().toLowerCase();
  const marketFilter = markets ?? new Set<string>();
  const sideFilter = sides ?? new Set<MlbPropBoardSide>();
  return rows.filter((row) => {
    if (teams.size > 0 && (!row.team_abbrev || !teams.has(row.team_abbrev))) {
      return false;
    }
    if (q && !row.player_name.toLowerCase().includes(q)) return false;
    if (marketFilter.size > 0 && !marketFilter.has(row.stat)) return false;
    if (sideFilter.size > 0 && !sideFilter.has(row.side)) return false;
    return true;
  });
}
