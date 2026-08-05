import { describe, expect, it } from "vitest";
import type { ApiMlbOddsGame } from "@/shared/lib/api";
import {
  findMlbOddsGame,
  formatAmericanOdds,
  toMlbOddsBoardView,
} from "./mlbOddsBoard";

const flatGame: ApiMlbOddsGame = {
  away_abbrev: "LAA",
  home_abbrev: "BAL",
  game_date: "2026-08-05",
  spread_line: -1.5,
  spread_team_abbrev: "BAL",
  total: 7.5,
  sportsbook: "pinnacle",
  board: null,
};

describe("mlbOddsBoard", () => {
  it("formats american odds with plus prefix", () => {
    expect(formatAmericanOdds(113)).toBe("+113");
    expect(formatAmericanOdds(-115)).toBe("-115");
  });

  it("finds game by abbrev and date", () => {
    const hit = findMlbOddsGame([flatGame], "laa", "bal", "2026-08-05");
    expect(hit?.home_abbrev).toBe("BAL");
  });

  it("falls back to an undated row when the date does not match", () => {
    const hit = findMlbOddsGame(
      [
        { ...flatGame, game_date: "2026-08-04" },
        { ...flatGame, game_date: null },
      ],
      "LAA",
      "BAL",
      "2026-08-05",
    );
    expect(hit?.game_date).toBeNull();
  });

  it("does not fall back to a differently dated row for the same matchup", () => {
    const hit = findMlbOddsGame(
      [{ ...flatGame, game_date: "2026-08-04" }],
      "LAA",
      "BAL",
      "2026-08-05",
    );
    expect(hit).toBeNull();
  });

  it("accepts any dated row when no date is requested", () => {
    const hit = findMlbOddsGame([{ ...flatGame, game_date: "2026-08-04" }], "LAA", "BAL");
    expect(hit?.game_date).toBe("2026-08-04");
  });

  it("maps pinnacle board to view rows", () => {
    const view = toMlbOddsBoardView(
      {
        away_abbrev: "LAA",
        home_abbrev: "BAL",
        game_date: "2026-08-05",
        spread_line: -1.5,
        spread_team_abbrev: "BAL",
        total: 7.5,
        sportsbook: "pinnacle",
        board: {
          away: {
            moneyline: 113,
            spread: { line: 1.5, price: -182 },
            total: { side: "over", line: 7.5, price: -113 },
          },
          home: {
            moneyline: -115,
            spread: { line: -1.5, price: 174 },
            total: { side: "under", line: 7.5, price: 108 },
          },
        },
      },
      "2026-08-05T18:00:00Z",
      "pinnacle",
    );
    expect(view?.rows[0].money).toEqual({ kind: "money", price: 113 });
    expect(view?.rows[1].total).toMatchObject({
      kind: "total",
      side: "under",
      line: 7.5,
      price: 108,
    });
  });

  it("derives thin board from flat sharp fields", () => {
    const view = toMlbOddsBoardView(
      {
        away_abbrev: "NYY",
        home_abbrev: "BOS",
        game_date: "2026-08-05",
        spread_line: -1.5,
        spread_team_abbrev: "NYY",
        total: 8.5,
        sportsbook: "draftkings",
        board: null,
      },
      null,
      "draftkings",
    );
    expect(view?.rows[0].spread).toMatchObject({
      kind: "spread",
      line: -1.5,
      price: null,
    });
    expect(view?.rows[1].spread).toMatchObject({
      kind: "spread",
      line: 1.5,
      price: null,
    });
    expect(view?.rows[0].money).toEqual({ kind: "money", price: null });
  });
});
