import { describe, expect, it } from "vitest";
import {
  collectWnbaBoardGameOptions,
  collectWnbaBoardPropositionOptions,
  filterWnbaPropBoardRows,
} from "./filterWnbaPropBoard";
import type { ApiWnbaPropBoardRow } from "@/shared/lib/api";

const row = (over: Partial<ApiWnbaPropBoardRow>): ApiWnbaPropBoardRow =>
  ({
    player_name: "Caitlin Clark",
    headshot_url: null,
    team_abbrev: "IND",
    opponent_abbrev: "NYL",
    home_away: "away",
    stat: "points",
    market_label: "Over 18.5 Points",
    side: "over",
    line: 18.5,
    game_id: "1",
    game_start_at: null,
    anchor: { book: "prizepicks", american: -137, url: null, line: 18.5 },
    books: [{ book: "prophetx", american: -115, url: null }],
    ip_pct: 53,
    opp_def_rank: 2,
    opp_def_label: "2nd BOS",
    opp_pace_rank: 5,
    opp_pace_label: "5th BOS",
    hit_l5: 60,
    hit_l10: 50,
    hit_l15: 40,
    hit_h2h: 50,
    ...over,
  }) as ApiWnbaPropBoardRow;

const emptyFilters = {
  query: "",
  markets: new Set<string>(),
  sides: new Set<"over" | "under">(),
  games: new Set<string>(),
};

describe("filterWnbaPropBoardRows", () => {
  it("filters by player substring", () => {
    const rows = [
      row({}),
      row({ player_name: "Rhyne Howard", team_abbrev: "ATL" }),
    ];
    const out = filterWnbaPropBoardRows(rows, {
      ...emptyFilters,
      query: "clark",
    });
    expect(out).toHaveLength(1);
    expect(out[0].player_name).toBe("Caitlin Clark");
  });

  it("returns all rows when no filters are active", () => {
    const rows = [
      row({}),
      row({ player_name: "Rhyne Howard", team_abbrev: "ATL" }),
    ];
    expect(filterWnbaPropBoardRows(rows, emptyFilters)).toEqual(rows);
  });

  it("trims the search query and matches case-insensitively", () => {
    const rows = [row({}), row({ player_name: "Rhyne Howard", team_abbrev: "ATL" })];
    expect(
      filterWnbaPropBoardRows(rows, { ...emptyFilters, query: "  cLaRk  " }),
    ).toEqual([rows[0]]);
  });

  it("filters by proposition market (stat) and over/under side", () => {
    const rows = [
      row({ player_name: "Caitlin Clark", stat: "points", side: "over" }),
      row({
        player_name: "Caitlin Clark",
        stat: "points",
        side: "under",
        market_label: "Under 18.5 Points",
      }),
      row({
        player_name: "A'ja Wilson",
        stat: "rebounds",
        side: "over",
        market_label: "Over 10.5 Rebounds",
        team_abbrev: "LV",
      }),
    ];
    expect(
      filterWnbaPropBoardRows(rows, {
        ...emptyFilters,
        markets: new Set(["points"]),
      }).map((r) => `${r.player_name}:${r.side}`),
    ).toEqual(["Caitlin Clark:over", "Caitlin Clark:under"]);
    expect(
      filterWnbaPropBoardRows(rows, {
        ...emptyFilters,
        sides: new Set(["over"]),
      }).map((r) => `${r.player_name}:${r.stat}`),
    ).toEqual(["Caitlin Clark:points", "A'ja Wilson:rebounds"]);
  });

  it("collects unique proposition options from market labels", () => {
    const options = collectWnbaBoardPropositionOptions([
      row({ stat: "points", market_label: "Over 18.5 Points" }),
      row({ stat: "points", market_label: "Under 18.5 Points" }),
      row({
        stat: "rebounds",
        market_label: "Over 10.5 Rebounds",
      }),
    ]);
    expect(options).toEqual([
      { value: "points", label: "Points" },
      { value: "rebounds", label: "Rebounds" },
    ]);
  });

  it("keeps rows the server already anchored and does not trim odds", () => {
    const rows = [
      row({
        books: [
          { book: "draftkings", american: -110, url: null, line: 18.5 },
          { book: "fanduel", american: -108, url: null, line: 18.5 },
        ],
      }),
    ];
    const out = filterWnbaPropBoardRows(rows, {
      query: "",
      markets: new Set(),
      sides: new Set(),
      games: new Set(),
    });
    expect(out).toHaveLength(1);
    expect(out[0].books.map((chip) => chip.book)).toEqual([
      "draftkings",
      "fanduel",
    ]);
  });

  it("collects unique games for the day, labeled as away @ home and ordered by start", () => {
    expect(
      collectWnbaBoardGameOptions([
        row({
          player_name: "Rhyne Howard",
          team_abbrev: "ATL",
          opponent_abbrev: "CHI",
          home_away: "away",
          game_id: "2",
          game_start_at: "2026-08-23T23:10:00Z",
        }),
        row({
          player_name: "Caitlin Clark",
          team_abbrev: "IND",
          opponent_abbrev: "NYL",
          home_away: "away",
          game_id: "1",
          game_start_at: "2026-08-23T20:10:00Z",
        }),
        row({
          player_name: "Kahleah Copper",
          team_abbrev: "PHX",
          opponent_abbrev: "LAS",
          home_away: "home",
          game_id: "3",
          game_start_at: "2026-08-23T17:10:00Z",
        }),
        row({
          player_name: "Aliyah Boston",
          team_abbrev: "IND",
          opponent_abbrev: "NYL",
          home_away: "away",
          game_id: "1",
          game_start_at: "2026-08-23T20:10:00Z",
        }),
        row({
          player_name: "No Game",
          game_id: null,
          team_abbrev: "PHX",
          opponent_abbrev: "LAS",
        }),
      ]),
    ).toEqual([
      { value: "3", label: "LAS @ PHX" },
      { value: "1", label: "IND @ NYL" },
      { value: "2", label: "ATL @ CHI" },
    ]);
  });

  it("filters by selected games and omits rows with no game when a game filter is active", () => {
    const rows = [
      row({ player_name: "Caitlin Clark", game_id: "1" }),
      row({
        player_name: "Rhyne Howard",
        team_abbrev: "ATL",
        game_id: "2",
      }),
      row({ player_name: "No Game", game_id: null }),
    ];
    expect(
      filterWnbaPropBoardRows(rows, {
        ...emptyFilters,
        games: new Set(["1"]),
      }).map((r) => r.player_name),
    ).toEqual(["Caitlin Clark"]);
  });
});
