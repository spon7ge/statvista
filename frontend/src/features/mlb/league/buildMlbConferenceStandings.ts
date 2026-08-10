import type {
  ApiMlbStandingsLeague,
  ApiMlbStandingsRow,
} from "@/shared/lib/api";

export type MlbStandingsTableSection = {
  key: string;
  label: string;
  teams: ApiMlbStandingsRow[];
};

function parsePct(pct: string): number {
  const n = Number.parseFloat(pct);
  return Number.isFinite(n) ? n : 0;
}

function formatGamesBack(leader: ApiMlbStandingsRow, team: ApiMlbStandingsRow): string {
  if (team.team_id === leader.team_id) return "-";
  const gb =
    (leader.wins - team.wins + (team.losses - leader.losses)) / 2;
  if (gb <= 0) return "-";
  return Number.isInteger(gb) ? String(gb) : gb.toFixed(1);
}

function rankLeagueTeams(teams: ApiMlbStandingsRow[]): ApiMlbStandingsRow[] {
  const sorted = [...teams].sort((a, b) => {
    const pctDiff = parsePct(b.pct) - parsePct(a.pct);
    if (pctDiff !== 0) return pctDiff;
    return b.wins - a.wins;
  });
  if (sorted.length === 0) return [];
  const leader = sorted[0];
  return sorted.map((team, index) => ({
    ...team,
    rank: index + 1,
    gb: formatGamesBack(leader, team),
  }));
}

export function buildMlbConferenceStandings(
  leagues: ApiMlbStandingsLeague[],
): MlbStandingsTableSection[] {
  const byKey = new Map(leagues.map((league) => [league.key, league]));
  const ordered: ApiMlbStandingsLeague[] = [];
  for (const key of ["al", "nl"] as const) {
    const league = byKey.get(key);
    if (league) ordered.push(league);
  }
  for (const league of leagues) {
    if (league.key !== "al" && league.key !== "nl") ordered.push(league);
  }

  return ordered.map((league) => {
    const seen = new Set<string>();
    const flat: ApiMlbStandingsRow[] = [];
    for (const division of league.divisions) {
      for (const team of division.teams) {
        if (seen.has(team.team_id)) continue;
        seen.add(team.team_id);
        flat.push(team);
      }
    }
    return {
      key: league.key,
      label: league.label,
      teams: rankLeagueTeams(flat),
    };
  });
}
