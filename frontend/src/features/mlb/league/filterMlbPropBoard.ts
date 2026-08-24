import type { ApiMlbPropBoardRow } from "@/shared/lib/api";

export type MlbPropBoardFilterSelection = {
  teams: Set<string>;
  query: string;
};

/**
 * Filters research-board rows by team and player name. Does not reorder
 * (the API already returns the board in display order).
 */
export function filterMlbPropBoardRows(
  rows: ApiMlbPropBoardRow[],
  { teams, query }: MlbPropBoardFilterSelection,
): ApiMlbPropBoardRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (teams.size > 0 && (!row.team_abbrev || !teams.has(row.team_abbrev))) {
      return false;
    }
    if (q && !row.player_name.toLowerCase().includes(q)) return false;
    return true;
  });
}
