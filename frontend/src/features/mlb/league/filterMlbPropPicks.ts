import type { ApiMlbPropRow } from "@/shared/lib/api";
import type { MlbPropPlayerCard } from "./groupMlbPropPlayers";

export type MlbPropFilterSelection = {
  stats: Set<string>;
  teams: Set<string>;
  sides: Set<string>;
};

export type MlbPropPlayerFilterSelection = {
  teams: Set<string>;
  query: string;
};

/**
 * Filters MLB prop rows client-side. The API already sorts by edge (No Sharp
 * Read parked last); this never reorders rows, only removes non-matching ones.
 */
export function filterMlbPropPicks(
  props: ApiMlbPropRow[],
  selection: MlbPropFilterSelection,
): ApiMlbPropRow[] {
  const { stats, teams, sides } = selection;
  return props.filter((row) => {
    if (stats.size > 0 && !stats.has(row.stat)) return false;
    if (teams.size > 0 && (!row.team_abbrev || !teams.has(row.team_abbrev))) {
      return false;
    }
    if (
      sides.size > 0 &&
      (!row.recommended_side || !sides.has(row.recommended_side))
    ) {
      return false;
    }
    return true;
  });
}

export function collectMlbStatOptions(props: ApiMlbPropRow[]): string[] {
  return [...new Set(props.map((p) => p.stat).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function collectMlbTeamOptions(props: ApiMlbPropRow[]): string[] {
  return [
    ...new Set(
      props
        .map((p) => p.team_abbrev)
        .filter((abbrev): abbrev is string => Boolean(abbrev)),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

/**
 * Filters grouped player cards by team and name. Does not reorder
 * (groupMlbPropPlayers already sorts by prop_count).
 */
export function filterMlbPropPlayers(
  players: MlbPropPlayerCard[],
  selection: MlbPropPlayerFilterSelection,
): MlbPropPlayerCard[] {
  const { teams, query } = selection;
  const needle = query.trim().toLowerCase();
  return players.filter((player) => {
    if (teams.size > 0 && (!player.team_abbrev || !teams.has(player.team_abbrev))) {
      return false;
    }
    if (needle && !player.player_name.toLowerCase().includes(needle)) {
      return false;
    }
    return true;
  });
}
