import type { ApiWnbaOddsGame, ApiWnbaOddsResponse } from "@/shared/lib/api";

/** Align ESPN tricodes with odds spellings — same map as mergeMatchupOdds. */
const ABBREV_ALIASES: Record<string, string> = {
  GS: "GSV",
  LA: "LAS",
  LV: "LVA",
  NY: "NYL",
  PHX: "PHO",
  POR: "PDX",
  CONN: "CON",
  WSH: "WAS",
};

export type WnbaOddsBoardTile =
  | { kind: "money"; price: number | null }
  | {
      kind: "total";
      side: "over" | "under";
      line: number | null;
      price: number | null;
    }
  | { kind: "spread"; line: number | null; price: number | null };

export type WnbaOddsBoardRowView = {
  side: "away" | "home";
  money: WnbaOddsBoardTile;
  total: WnbaOddsBoardTile;
  spread: WnbaOddsBoardTile;
};

export type WnbaOddsBookBoardView = {
  sportsbook: string;
  asOf: string | null;
  rows: [WnbaOddsBoardRowView, WnbaOddsBoardRowView];
};

function canonicalAbbrev(abbrev: string, wnbaAliases: boolean): string {
  const upper = abbrev.trim().toUpperCase();
  if (!wnbaAliases) return upper;
  return ABBREV_ALIASES[upper] ?? upper;
}

function matchupKey(
  awayAbbrev: string,
  homeAbbrev: string,
  wnbaAliases: boolean,
): string {
  return `${canonicalAbbrev(awayAbbrev, wnbaAliases)}@${canonicalAbbrev(homeAbbrev, wnbaAliases)}`;
}

function matchesWnbaOddsMatchup(
  game: ApiWnbaOddsGame,
  awayAbbrev: string,
  homeAbbrev: string,
  wnbaAliases: boolean,
): boolean {
  return (
    matchupKey(game.away_abbrev, game.home_abbrev, wnbaAliases) ===
    matchupKey(awayAbbrev, homeAbbrev, wnbaAliases)
  );
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function findWnbaOddsGamesForMatchup(
  games: ApiWnbaOddsGame[] | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
  opts?: { wnbaAliases?: boolean },
): ApiWnbaOddsGame[] {
  if (!games?.length) return [];
  const wnbaAliases = opts?.wnbaAliases ?? true;
  return games.filter((game) =>
    matchesWnbaOddsMatchup(game, awayAbbrev, homeAbbrev, wnbaAliases),
  );
}

function moneyTile(price: number | null): WnbaOddsBoardTile {
  return { kind: "money", price };
}

function spreadTile(line: number | null, price: number | null): WnbaOddsBoardTile {
  return { kind: "spread", line, price };
}

function totalTile(
  side: "over" | "under",
  line: number | null,
  price: number | null,
): WnbaOddsBoardTile {
  return { kind: "total", side, line, price };
}

function flatSpreadLines(game: ApiWnbaOddsGame): [number | null, number | null] {
  if (game.spread_line == null || !game.spread_team_abbrev) {
    return [null, null];
  }

  const spreadTeam = canonicalAbbrev(game.spread_team_abbrev, true);
  if (spreadTeam === canonicalAbbrev(game.away_abbrev, true)) {
    return [game.spread_line, -game.spread_line];
  }
  if (spreadTeam === canonicalAbbrev(game.home_abbrev, true)) {
    return [-game.spread_line, game.spread_line];
  }
  return [null, null];
}

export function toWnbaOddsBoardView(
  game: ApiWnbaOddsGame,
  asOf: string | null,
): WnbaOddsBookBoardView | null {
  const sportsbook = game.sportsbook?.trim() || null;
  if (!sportsbook) return null;

  const [awaySpread, homeSpread] = flatSpreadLines(game);
  if (
    awaySpread == null &&
    game.total == null &&
    game.away_moneyline == null &&
    game.home_moneyline == null
  ) {
    return null;
  }

  return {
    sportsbook,
    asOf,
    rows: [
      {
        side: "away",
        money: moneyTile(game.away_moneyline ?? null),
        spread: spreadTile(awaySpread, null),
        total: totalTile("over", game.total ?? null, null),
      },
      {
        side: "home",
        money: moneyTile(game.home_moneyline ?? null),
        spread: spreadTile(homeSpread, null),
        total: totalTile("under", game.total ?? null, null),
      },
    ],
  };
}

export function collectWnbaOddsBookBoards(
  response: ApiWnbaOddsResponse | null | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
  opts?: { wnbaAliases?: boolean },
): WnbaOddsBookBoardView[] {
  if (!response) return [];

  const asOf = response.as_of ?? null;
  const games = findWnbaOddsGamesForMatchup(
    response.games,
    awayAbbrev,
    homeAbbrev,
    opts,
  );

  const views: WnbaOddsBookBoardView[] = [];
  for (const game of games) {
    const view = toWnbaOddsBoardView(game, asOf);
    if (!view) continue;
    views.push(view);
  }
  return views;
}
