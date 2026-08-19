import type { ApiWnbaGame, ApiWnbaPropRow } from "@/shared/lib/api";
import type { WnbaPropPlayerCard } from "./groupWnbaPropPlayers";

export type WnbaPropFilterSelection = {
  stats: Set<string>;
  teams: Set<string>;
  sides: Set<string>;
};

export type WnbaPropPlayerFilterSelection = {
  teams: Set<string>;
  query: string;
};

type PastGamePropRow = Pick<ApiWnbaPropRow, "team_abbrev" | "commence_time">;

/**
 * Filters WNBA +EV prop rows client-side. The API already sorts by edge; this
 * never reorders rows, only removes non-matching ones. Side filter matches
 * `recommended_side` (not a raw book `side` field).
 */
export function filterWnbaPropPicks(
  props: ApiWnbaPropRow[],
  selection: WnbaPropFilterSelection,
): ApiWnbaPropRow[] {
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

export function collectWnbaStatOptions(props: ApiWnbaPropRow[]): string[] {
  return [...new Set(props.map((p) => p.stat).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function collectWnbaTeamOptions(props: ApiWnbaPropRow[]): string[] {
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
 * (groupWnbaPropPlayers already sorts by prop_count).
 */
export function filterWnbaPropPlayers(
  players: WnbaPropPlayerCard[],
  selection: WnbaPropPlayerFilterSelection,
): WnbaPropPlayerCard[] {
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

/** Align ESPN tricodes with odds/props spellings (same map as wnbaOddsBoard). */
const WNBA_ABBREV_ALIASES: Record<string, string> = {
  GS: "GSV",
  LA: "LAS",
  LV: "LVA",
  NY: "NYL",
  PHX: "PHO",
  POR: "PDX",
  CONN: "CON",
  WSH: "WAS",
};

/**
 * Expand team abbrevs so filters match both ESPN and DFS spellings
 * (e.g. PHO ↔ PHX, NYL ↔ NY).
 */
export function expandWnbaTeamAbbrevs(abbrevs: string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of abbrevs) {
    const upper = raw.trim().toUpperCase();
    if (!upper) continue;
    out.add(upper);
    const canonical = WNBA_ABBREV_ALIASES[upper] ?? upper;
    out.add(canonical);
    for (const [alias, canon] of Object.entries(WNBA_ABBREV_ALIASES)) {
      if (canon === canonical || canon === upper || alias === upper) {
        out.add(alias);
        out.add(canon);
      }
    }
  }
  return out;
}

/**
 * Tip date in America/New_York for a commence_time ISO string.
 * Returns YYYY-MM-DD or null when unparsable.
 */
export function tipEtDate(commenceTime: string | null | undefined): string | null {
  if (!commenceTime) return null;
  const parsed = new Date(commenceTime);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function excludePropsFromFinalGames<T extends PastGamePropRow>(
  props: T[],
  games: ApiWnbaGame[] | undefined | null,
): T[] {
  if (!games || games.length === 0) return props;

  const finalAbbrevs: string[] = [];
  for (const g of games) {
    if (g.status !== "final") continue;
    if (g.home?.abbrev) finalAbbrevs.push(g.home.abbrev);
    if (g.away?.abbrev) finalAbbrevs.push(g.away.abbrev);
  }
  if (finalAbbrevs.length === 0) return props;

  const finalTeams = expandWnbaTeamAbbrevs(finalAbbrevs);
  return props.filter(
    (row) => !row.team_abbrev || !finalTeams.has(row.team_abbrev),
  );
}

/**
 * Drop props for finished / past games.
 *
 * - Teams already final on the scoreboard are removed (abbrev aliases expanded).
 * - Tips whose ET calendar date is before the scoreboard slate date are removed.
 * Upcoming and in-progress tips are kept.
 */
export function excludePastGameProps<T extends PastGamePropRow>(
  props: T[],
  games: ApiWnbaGame[] | undefined | null,
  scoreboardDate: string | null | undefined,
): T[] {
  let out = excludePropsFromFinalGames(props, games);
  if (!scoreboardDate) return out;

  return out.filter((row) => {
    const tip = tipEtDate(row.commence_time);
    if (!tip) return true;
    return tip >= scoreboardDate;
  });
}
