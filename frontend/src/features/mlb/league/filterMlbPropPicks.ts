import type { ApiMlbPropRow } from "@/shared/lib/api";

export const MLB_SOURCE_TIER_OPTIONS = [
  { value: "sharp_consensus", label: "Sharp Consensus" },
  { value: "sharp_disagreement", label: "Sharp Disagreement" },
  { value: "sharp_single_source", label: "Sharp Single-Source" },
  { value: "mid_tier_fallback", label: "Mid-Tier Fallback" },
  { value: "no_sharp_read", label: "No Sharp Read" },
] as const;

/** Recency chip that isolates the "fresh sharp vs stale DFS" toggle filter. */
export const FRESH_VS_STALE_DFS_CHIP = "fresh_sharp_vs_stale_dfs";

export type MlbPropFilterSelection = {
  stats: Set<string>;
  teams: Set<string>;
  sides: Set<string>;
  tiers: Set<string>;
  /** When true, only rows whose recency chip is "fresh sharp vs stale DFS" pass. */
  freshVsStaleOnly: boolean;
};

/**
 * Filters MLB prop rows client-side. The API already sorts by edge (No Sharp
 * Read parked last); this never reorders rows, only removes non-matching ones.
 */
export function filterMlbPropPicks(
  props: ApiMlbPropRow[],
  selection: MlbPropFilterSelection,
): ApiMlbPropRow[] {
  const { stats, teams, sides, tiers, freshVsStaleOnly } = selection;
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
    if (tiers.size > 0 && !tiers.has(row.source_tier)) return false;
    if (freshVsStaleOnly && row.recency_chip !== FRESH_VS_STALE_DFS_CHIP) {
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
