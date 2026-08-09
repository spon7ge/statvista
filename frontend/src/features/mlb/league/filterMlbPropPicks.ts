import type { ApiMlbPropRow } from "@/shared/lib/api";

export type MlbPropFilterSelection = {
  stats: Set<string>;
  teams: Set<string>;
  sides: Set<string>;
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
