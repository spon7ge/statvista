import { describe, expect, it } from "vitest";
import type { ApiWnbaOddsGame } from "@/shared/lib/api";
import {
  collectWnbaOddsBookBoards,
  findWnbaOddsGamesForMatchup,
  formatAmericanOdds,
  toWnbaOddsBoardView,
} from "./wnbaOddsBoard";

function game(
  overrides: Partial<ApiWnbaOddsGame> = {},
): ApiWnbaOddsGame {
  return {
    away_abbrev: "SEA",
    home_abbrev: "ATL",
    game_date: "2026-08-10",
    spread_line: -4.5,
    spread_team_abbrev: "ATL",
    total: 162.5,
    away_moneyline: 165,
    home_moneyline: -195,
    sportsbook: "pinnacle",
    ...overrides,
  };
}

describe("wnbaOddsBoard", () => {
  it("formats american odds with plus prefix", () => {
    expect(formatAmericanOdds(165)).toBe("+165");
    expect(formatAmericanOdds(-195)).toBe("-195");
  });

  it("finds games by abbrev with WNBA aliases (PHX→PHO)", () => {
    const hits = findWnbaOddsGamesForMatchup(
      [game({ away_abbrev: "NYL", home_abbrev: "PHO" })],
      "NYL",
      "PHX",
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].home_abbrev).toBe("PHO");
  });

  it("matches CON scoreboard abbrev to CONN odds abbrev", () => {
    const hits = findWnbaOddsGamesForMatchup(
      [game({ away_abbrev: "CONN", home_abbrev: "IND" })],
      "CON",
      "IND",
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].away_abbrev).toBe("CONN");
  });

  it("matches GS scoreboard abbrev to GSV odds abbrev", () => {
    const hits = findWnbaOddsGamesForMatchup(
      [game({ away_abbrev: "GSV", home_abbrev: "LAS" })],
      "GS",
      "LA",
    );
    expect(hits).toHaveLength(1);
  });

  it("can disable WNBA aliases", () => {
    const hits = findWnbaOddsGamesForMatchup(
      [game({ away_abbrev: "NYL", home_abbrev: "PHO" })],
      "NYL",
      "PHX",
      { wnbaAliases: false },
    );
    expect(hits).toHaveLength(0);
  });

  it("returns all sportsbooks for the matchup in API order", () => {
    const hits = findWnbaOddsGamesForMatchup(
      [
        game({ sportsbook: "pinnacle", total: 162.5 }),
        game({ sportsbook: "draftkings", total: 163.5 }),
        game({ away_abbrev: "DAL", home_abbrev: "WAS", sportsbook: "pinnacle" }),
      ],
      "SEA",
      "ATL",
    );
    expect(hits.map((g) => g.sportsbook)).toEqual(["pinnacle", "draftkings"]);
  });

  it("maps flat fields to board view rows including moneyline", () => {
    const view = toWnbaOddsBoardView(
      game({
        spread_line: -4.5,
        spread_team_abbrev: "ATL",
        total: 162.5,
        away_moneyline: 165,
        home_moneyline: -195,
      }),
      "2026-08-10T18:00:00Z",
    );
    expect(view?.sportsbook).toBe("pinnacle");
    expect(view?.rows[0].money).toEqual({ kind: "money", price: 165 });
    expect(view?.rows[1].money).toEqual({ kind: "money", price: -195 });
    expect(view?.rows[0].spread).toMatchObject({
      kind: "spread",
      line: 4.5,
      price: null,
    });
    expect(view?.rows[1].spread).toMatchObject({
      kind: "spread",
      line: -4.5,
      price: null,
    });
    expect(view?.rows[0].total).toMatchObject({
      kind: "total",
      side: "over",
      line: 162.5,
    });
    expect(view?.rows[1].total).toMatchObject({
      kind: "total",
      side: "under",
      line: 162.5,
    });
  });

  it("dashes money when moneyline fields are null", () => {
    const view = toWnbaOddsBoardView(
      game({ away_moneyline: null, home_moneyline: null }),
      null,
    );
    expect(view?.rows[0].money).toEqual({ kind: "money", price: null });
    expect(view?.rows[1].money).toEqual({ kind: "money", price: null });
  });

  it("collects book boards grouped by sportsbook for the matchup", () => {
    const views = collectWnbaOddsBookBoards(
      {
        as_of: "2026-08-10T15:00:00Z",
        sportsbook: "pinnacle",
        error: null,
        games: [
          game({ sportsbook: "pinnacle" }),
          game({ sportsbook: "draftkings", away_moneyline: null, home_moneyline: null }),
        ],
      },
      "SEA",
      "ATL",
    );
    expect(views.map((v) => v.sportsbook)).toEqual(["pinnacle", "draftkings"]);
    expect(views[0].asOf).toBe("2026-08-10T15:00:00Z");
    expect(views[0].rows[0].money).toEqual({ kind: "money", price: 165 });
  });

  it("returns empty when no matchup games", () => {
    const views = collectWnbaOddsBookBoards(
      {
        as_of: "2026-08-10T15:00:00Z",
        sportsbook: "pinnacle",
        error: null,
        games: [game({ away_abbrev: "DAL", home_abbrev: "WAS" })],
      },
      "SEA",
      "ATL",
    );
    expect(views).toEqual([]);
  });
});
