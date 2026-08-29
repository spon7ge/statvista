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

export type MlbOddsBookBoardView = {
  sportsbook: string;
  asOf: string | null;
  rows: [MlbOddsBoardRowView, MlbOddsBoardRowView];
};

function canonicalAbbrev(abbrev: string): string {
  return abbrev.trim().toUpperCase();
}

function matchupKey(awayAbbrev: string, homeAbbrev: string): string {
  return `${canonicalAbbrev(awayAbbrev)}@${canonicalAbbrev(homeAbbrev)}`;
}

function matchesMlbOddsMatchup(
  game: ApiMlbOddsGame,
  awayAbbrev: string,
  homeAbbrev: string,
): boolean {
  return matchupKey(game.away_abbrev, game.home_abbrev) === matchupKey(awayAbbrev, homeAbbrev);
}

function isMlbOddsGameDateMatch(game: ApiMlbOddsGame, gameDate?: string): boolean {
  if (!gameDate) return true;
  if (game.game_date === gameDate) return true;
  if (!game.game_date) return true;
  return false;
}

function filterMlbOddsGamesForMatchup(
  games: ApiMlbOddsGame[] | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
  gameDate?: string,
): ApiMlbOddsGame[] {
  if (!games?.length) return [];
  return games.filter(
    (game) =>
      matchesMlbOddsMatchup(game, awayAbbrev, homeAbbrev) &&
      isMlbOddsGameDateMatch(game, gameDate),
  );
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/** Raw implied win % from American odds (vig still in). */
export function impliedPctFromAmerican(american: number): number {
  const p =
    american > 0
      ? 100 / (american + 100)
      : Math.abs(american) / (Math.abs(american) + 100);
  return Math.round(p * 100);
}

export function findMlbOddsGame(
  games: ApiMlbOddsResponse["games"] | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
  gameDate?: string,
): ApiMlbOddsGame | null {
  if (!games?.length) return null;

  let undated: ApiMlbOddsGame | null = null;
  let dated: ApiMlbOddsGame | null = null;

  for (const game of games) {
    if (!matchesMlbOddsMatchup(game, awayAbbrev, homeAbbrev)) continue;
    if (gameDate && game.game_date === gameDate) return game;
    if (!game.game_date) {
      undated ??= game;
    } else {
      dated ??= game;
    }
  }

  // A row dated to another day is a different game in the same series, so it
  // is only safe to use when the caller has no date to match against. This
  // mirrors mergeMatchupOdds.
  return undated ?? (gameDate ? null : dated);
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

export function collectMlbOddsBookBoards(
  response: ApiMlbOddsResponse | null | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
  gameDate?: string,
): MlbOddsBookBoardView[] {
  if (!response) return [];

  const asOf = response.as_of ?? null;
  const games = response.book_boards?.length
    ? filterMlbOddsGamesForMatchup(response.book_boards, awayAbbrev, homeAbbrev, gameDate)
    : (() => {
        const game = findMlbOddsGame(response.games, awayAbbrev, homeAbbrev, gameDate);
        return game ? [game] : [];
      })();

  const views: MlbOddsBookBoardView[] = [];
  for (const game of games) {
    const view = toMlbOddsBoardView(game, asOf, game.sportsbook);
    if (!view?.sportsbook) continue;
    views.push({
      sportsbook: view.sportsbook,
      asOf: view.asOf,
      rows: view.rows,
    });
  }
  return views;
}
