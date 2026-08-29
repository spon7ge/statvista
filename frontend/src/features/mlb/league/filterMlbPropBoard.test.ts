import { describe, expect, it } from "vitest";
import {
  collectMlbBoardBookmakerOptions,
  collectMlbBoardGameOptions,
  collectMlbBoardPropositionOptions,
  filterMlbPropBoardRows,
} from "./filterMlbPropBoard";
import type { ApiMlbPropBoardRow } from "@/shared/lib/api";

const row = (over: Partial<ApiMlbPropBoardRow>): ApiMlbPropBoardRow =>
  ({
    player_name: "Aaron Judge",
    headshot_url: null,
    team_abbrev: "NYY",
    opponent_abbrev: "BOS",
    home_away: "away",
    stat: "hits",
    market_label: "Over 1.5 Hits",
    side: "over",
    line: 1.5,
    game_pk: 1,
    game_start_at: null,
    dfs: [],
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
  }) as ApiMlbPropBoardRow;

describe("filterMlbPropBoardRows", () => {
  it("filters by team and player substring", () => {
    const rows = [
      row({}),
      row({ player_name: "Mookie Betts", team_abbrev: "LAD" }),
    ];
    const out = filterMlbPropBoardRows(rows, {
      teams: new Set(["NYY"]),
      query: "judge",
    });
    expect(out).toHaveLength(1);
    expect(out[0].player_name).toBe("Aaron Judge");
  });

  it("returns all rows when no filters are active", () => {
    const rows = [
      row({}),
      row({ player_name: "Mookie Betts", team_abbrev: "LAD" }),
    ];
    expect(filterMlbPropBoardRows(rows, { teams: new Set(), query: "" })).toEqual(
      rows,
    );
  });

  it("excludes rows with a null team when a team filter is active", () => {
    const noTeam = row({ player_name: "No Team", team_abbrev: null });
    expect(
      filterMlbPropBoardRows([noTeam], { teams: new Set(["NYY"]), query: "" }),
    ).toEqual([]);
  });

  it("trims the search query and matches case-insensitively", () => {
    const rows = [row({}), row({ player_name: "Mookie Betts", team_abbrev: "LAD" })];
    expect(
      filterMlbPropBoardRows(rows, { teams: new Set(), query: "  jUdGe  " }),
    ).toEqual([rows[0]]);
  });

  it("filters by proposition market (stat) and over/under side", () => {
    const rows = [
      row({ player_name: "Aaron Judge", stat: "hits", side: "over" }),
      row({
        player_name: "Aaron Judge",
        stat: "hits",
        side: "under",
        market_label: "Under 1.5 Hits",
      }),
      row({
        player_name: "Shohei Ohtani",
        stat: "strikeouts",
        side: "over",
        market_label: "Over 6.5 Strikeouts",
        team_abbrev: "LAD",
      }),
    ];
    expect(
      filterMlbPropBoardRows(rows, {
        teams: new Set(),
        query: "",
        markets: new Set(["hits"]),
      }).map((r) => `${r.player_name}:${r.side}`),
    ).toEqual(["Aaron Judge:over", "Aaron Judge:under"]);
    expect(
      filterMlbPropBoardRows(rows, {
        teams: new Set(),
        query: "",
        sides: new Set(["over"]),
      }).map((r) => `${r.player_name}:${r.stat}`),
    ).toEqual(["Aaron Judge:hits", "Shohei Ohtani:strikeouts"]);
  });

  it("collects unique proposition options from market labels", () => {
    const options = collectMlbBoardPropositionOptions([
      row({ stat: "hits", market_label: "Over 1.5 Hits" }),
      row({ stat: "hits", market_label: "Under 0.5 Hits" }),
      row({
        stat: "strikeouts",
        market_label: "Over 6.5 Strikeouts",
      }),
    ]);
    expect(options).toEqual([
      { value: "hits", label: "Hits" },
      { value: "strikeouts", label: "Strikeouts" },
    ]);
  });

  it("filters by bookmaker and keeps only selected book chips", () => {
    const rows = [
      row({
        player_name: "Aaron Judge",
        books: [
          { book: "prophetx", american: -115, url: null },
          { book: "draftkings", american: -120, url: null },
        ],
      }),
      row({
        player_name: "Mookie Betts",
        team_abbrev: "LAD",
        books: [{ book: "fanduel", american: -108, url: null }],
      }),
    ];
    const out = filterMlbPropBoardRows(rows, {
      teams: new Set(),
      query: "",
      books: new Set(["draftkings"]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].player_name).toBe("Aaron Judge");
    expect(out[0].books.map((chip) => chip.book)).toEqual(["draftkings"]);
  });

  it("drops rows with no posted American odds", () => {
    const rows = [
      row({ player_name: "Aaron Judge", books: [], dfs: [] }),
      row({
        player_name: "Juan Soto",
        books: [{ book: "fanduel", american: null, url: null }],
        dfs: [],
      }),
      row({
        player_name: "Mookie Betts",
        books: [],
        dfs: [{ book: "prizepicks", american: null, url: null }],
      }),
      row({
        player_name: "Freddie Freeman",
        team_abbrev: "LAD",
        books: [{ book: "draftkings", american: -120, url: null }],
        dfs: [],
      }),
    ];
    expect(
      filterMlbPropBoardRows(rows, { teams: new Set(), query: "" }).map(
        (r) => r.player_name,
      ),
    ).toEqual(["Mookie Betts", "Freddie Freeman"]);
  });

  it("filters PrizePicks on dfs and clears Odds", () => {
    const rows = [
      row({
        player_name: "Aaron Judge",
        dfs: [{ book: "prizepicks", american: null, url: null }],
        books: [{ book: "prophetx", american: -115, url: null }],
      }),
      row({
        player_name: "Mookie Betts",
        team_abbrev: "LAD",
        dfs: [],
        books: [{ book: "draftkings", american: -120, url: null }],
      }),
    ];
    const out = filterMlbPropBoardRows(rows, {
      teams: new Set(),
      query: "",
      books: new Set(["prizepicks"]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].player_name).toBe("Aaron Judge");
    expect(out[0].dfs.map((chip) => chip.book)).toEqual(["prizepicks"]);
    expect(out[0].books).toEqual([]);
  });

  it("filters DraftKings on books and clears DFS", () => {
    const rows = [
      row({
        player_name: "Aaron Judge",
        dfs: [{ book: "prizepicks", american: null, url: null }],
        books: [{ book: "draftkings", american: -120, url: null }],
      }),
    ];
    const out = filterMlbPropBoardRows(rows, {
      teams: new Set(),
      query: "",
      books: new Set(["draftkings"]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].books.map((chip) => chip.book)).toEqual(["draftkings"]);
    expect(out[0].dfs).toEqual([]);
  });

  it("collects unique bookmaker options in chip order", () => {
    expect(
      collectMlbBoardBookmakerOptions([
        row({
          dfs: [{ book: "underdog", american: -105, url: null }],
          books: [{ book: "draftkings", american: -120, url: null }],
        }),
        row({
          books: [{ book: "draftkings", american: -110, url: null }],
        }),
      ]),
    ).toEqual([
      { value: "draftkings", label: "DraftKings" },
      { value: "underdog", label: "Underdog" },
    ]);
  });

  it("collects unique games for the day, labeled as away @ home and ordered by start", () => {
    expect(
      collectMlbBoardGameOptions([
        row({
          player_name: "Mookie Betts",
          team_abbrev: "LAD",
          opponent_abbrev: "SF",
          home_away: "away",
          game_pk: 2,
          game_start_at: "2026-08-23T23:10:00Z",
        }),
        row({
          player_name: "Aaron Judge",
          team_abbrev: "NYY",
          opponent_abbrev: "BOS",
          home_away: "away",
          game_pk: 1,
          game_start_at: "2026-08-23T20:10:00Z",
        }),
        row({
          player_name: "Dansby Swanson",
          team_abbrev: "CHC",
          opponent_abbrev: "MIL",
          home_away: "home",
          game_pk: 3,
          game_start_at: "2026-08-23T17:10:00Z",
        }),
        row({
          player_name: "Juan Soto",
          team_abbrev: "NYY",
          opponent_abbrev: "BOS",
          home_away: "away",
          game_pk: 1,
          game_start_at: "2026-08-23T20:10:00Z",
        }),
        row({
          player_name: "No Game",
          game_pk: null,
          team_abbrev: "CHC",
          opponent_abbrev: "MIL",
        }),
      ]),
    ).toEqual([
      { value: "3", label: "MIL @ CHC" },
      { value: "1", label: "NYY @ BOS" },
      { value: "2", label: "LAD @ SF" },
    ]);
  });

  it("filters by selected games and omits rows with no game when a game filter is active", () => {
    const rows = [
      row({ player_name: "Aaron Judge", game_pk: 1 }),
      row({
        player_name: "Mookie Betts",
        team_abbrev: "LAD",
        game_pk: 2,
      }),
      row({ player_name: "No Game", game_pk: null }),
    ];
    expect(
      filterMlbPropBoardRows(rows, {
        teams: new Set(),
        query: "",
        games: new Set(["1"]),
      }).map((r) => r.player_name),
    ).toEqual(["Aaron Judge"]);
  });
});
