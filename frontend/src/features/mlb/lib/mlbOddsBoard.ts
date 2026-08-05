import type { ApiMlbOddsGame, ApiMlbOddsResponse } from "@/shared/lib/api";

export type MlbOddsBoardTile =
  | { kind: "money"; price: number | null }
  | {
      kind: "total";
      side: "over" | "under";
      line: number | null;
      price: number | null;
    }
  | { kind: "spread"; line: number | null; price: number | null };

export type MlbOddsBoardRowView = {
  side: "away" | "home";
  money: MlbOddsBoardTile;
  total: MlbOddsBoardTile;
  spread: MlbOddsBoardTile;
};

export type MlbOddsBoardView = {
  sportsbook: string | null;
  asOf: string | null;
  rows: [MlbOddsBoardRowView, MlbOddsBoardRowView];
};

function canonicalAbbrev(abbrev: string): string {
  return abbrev.trim().toUpperCase();
}

function matchupKey(awayAbbrev: string, homeAbbrev: string): string {
  return `${canonicalAbbrev(awayAbbrev)}@${canonicalAbbrev(homeAbbrev)}`;
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function findMlbOddsGame(
  games: ApiMlbOddsResponse["games"] | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
  gameDate?: string,
): ApiMlbOddsGame | null {
  if (!games?.length) return null;

  const key = matchupKey(awayAbbrev, homeAbbrev);
  let undated: ApiMlbOddsGame | null = null;
  let dated: ApiMlbOddsGame | null = null;

  for (const game of games) {
    if (matchupKey(game.away_abbrev, game.home_abbrev) !== key) continue;
    if (gameDate && game.game_date === gameDate) return game;
    if (!game.game_date && !undated) undated = game;
    if (game.game_date && !dated) dated = game;
  }

  return undated ?? dated;
}

function moneyTile(price: number | null): MlbOddsBoardTile {
  return { kind: "money", price };
}

function spreadTile(line: number | null, price: number | null): MlbOddsBoardTile {
  return { kind: "spread", line, price };
}

function totalTile(
  side: "over" | "under",
  line: number | null,
  price: number | null,
): MlbOddsBoardTile {
  return { kind: "total", side, line, price };
}

function flatSpreadLines(game: ApiMlbOddsGame): [number | null, number | null] {
  if (game.spread_line == null || !game.spread_team_abbrev) {
    return [null, null];
  }

  const spreadTeam = canonicalAbbrev(game.spread_team_abbrev);
  if (spreadTeam === canonicalAbbrev(game.away_abbrev)) {
    return [game.spread_line, -game.spread_line];
  }
  if (spreadTeam === canonicalAbbrev(game.home_abbrev)) {
    return [-game.spread_line, game.spread_line];
  }
  return [null, null];
}

export function toMlbOddsBoardView(
  game: ApiMlbOddsGame,
  asOf: string | null,
  responseSportsbook: string | null,
): MlbOddsBoardView | null {
  const sportsbook = game.sportsbook?.trim() || responseSportsbook?.trim() || null;

  if (game.board) {
    const { away, home } = game.board;
    return {
      sportsbook,
      asOf,
      rows: [
        {
          side: "away",
          money: moneyTile(away.moneyline),
          spread: spreadTile(away.spread?.line ?? null, away.spread?.price ?? null),
          total: totalTile(
            away.total?.side ?? "over",
            away.total?.line ?? null,
            away.total?.price ?? null,
          ),
        },
        {
          side: "home",
          money: moneyTile(home.moneyline),
          spread: spreadTile(home.spread?.line ?? null, home.spread?.price ?? null),
          total: totalTile(
            home.total?.side ?? "under",
            home.total?.line ?? null,
            home.total?.price ?? null,
          ),
        },
      ],
    };
  }

  const [awaySpread, homeSpread] = flatSpreadLines(game);
  if (awaySpread == null && game.total == null) return null;

  return {
    sportsbook,
    asOf,
    rows: [
      {
        side: "away",
        money: moneyTile(null),
        spread: spreadTile(awaySpread, null),
        total: totalTile("over", game.total, null),
      },
      {
        side: "home",
        money: moneyTile(null),
        spread: spreadTile(homeSpread, null),
        total: totalTile("under", game.total, null),
      },
    ],
  };
}
