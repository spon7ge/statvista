import type {
  ApiNbaOddsGame,
  ApiNbaOddsResponse,
} from "@/shared/lib/api";

/** Align common short tricodes with ESPN's NBA tricodes. */
const ABBREV_ALIASES: Record<string, string> = {
  GS: "GSW",
  NO: "NOP",
  NY: "NYK",
  PHO: "PHX",
  SA: "SAS",
  WSH: "WAS",
};

export type NbaOddsBoardTile =
  | { kind: "money"; price: number | null }
  | {
      kind: "total";
      side: "over" | "under";
      line: number | null;
      price: number | null;
    }
  | { kind: "spread"; line: number | null; price: number | null };

export type NbaOddsBoardRowView = {
  side: "away" | "home";
  money: NbaOddsBoardTile;
  total: NbaOddsBoardTile;
  spread: NbaOddsBoardTile;
};

export type NbaOddsBookBoardView = {
  sportsbook: string;
  asOf: string | null;
  rows: [NbaOddsBoardRowView, NbaOddsBoardRowView];
};

function canonicalAbbrev(abbrev: string): string {
  const upper = abbrev.trim().toUpperCase();
  return ABBREV_ALIASES[upper] ?? upper;
}

function matchupKey(awayAbbrev: string, homeAbbrev: string): string {
  return `${canonicalAbbrev(awayAbbrev)}@${canonicalAbbrev(homeAbbrev)}`;
}

function matchesNbaOddsMatchup(
  game: ApiNbaOddsGame,
  awayAbbrev: string,
  homeAbbrev: string,
): boolean {
  return (
    matchupKey(game.away_abbrev, game.home_abbrev) ===
    matchupKey(awayAbbrev, homeAbbrev)
  );
}

export function findNbaOddsGamesForMatchup(
  games: ApiNbaOddsGame[] | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
): ApiNbaOddsGame[] {
  if (!games?.length) return [];
  return games.filter((game) =>
    matchesNbaOddsMatchup(game, awayAbbrev, homeAbbrev),
  );
}

function moneyTile(price: number | null): NbaOddsBoardTile {
  return { kind: "money", price };
}

function spreadTile(line: number | null, price: number | null): NbaOddsBoardTile {
  return { kind: "spread", line, price };
}

function totalTile(
  side: "over" | "under",
  line: number | null,
  price: number | null,
): NbaOddsBoardTile {
  return { kind: "total", side, line, price };
}

function flatSpreadLines(
  game: ApiNbaOddsGame,
): [number | null, number | null] {
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

export function toNbaOddsBoardView(
  game: ApiNbaOddsGame,
  asOf: string | null,
): NbaOddsBookBoardView | null {
  const sportsbook = game.sportsbook?.trim() || null;
  if (!sportsbook) return null;

  if (game.board) {
    const { away, home } = game.board;
    return {
      sportsbook,
      asOf,
      rows: [
        {
          side: "away",
          money: moneyTile(away.moneyline),
          spread: spreadTile(
            away.spread?.line ?? null,
            away.spread?.price ?? null,
          ),
          total: totalTile(
            away.total?.side ?? "over",
            away.total?.line ?? null,
            away.total?.price ?? null,
          ),
        },
        {
          side: "home",
          money: moneyTile(home.moneyline),
          spread: spreadTile(
            home.spread?.line ?? null,
            home.spread?.price ?? null,
          ),
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

export function collectNbaOddsBookBoards(
  response: ApiNbaOddsResponse | null | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
): NbaOddsBookBoardView[] {
  if (!response) return [];

  const asOf = response.as_of ?? null;
  const source =
    response.book_boards?.length ? response.book_boards : response.games;
  const games = findNbaOddsGamesForMatchup(
    source,
    awayAbbrev,
    homeAbbrev,
  );

  const views: NbaOddsBookBoardView[] = [];
  for (const game of games) {
    const view = toNbaOddsBoardView(game, asOf);
    if (view) views.push(view);
  }
  return views;
}
