import { describe, expect, it } from "vitest";
import {
  collectWnbaBoardBookmakerOptions,
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
    line: 1.5,
    game_id: 1,
    game_start_at: null,
    dfs: [{ book: "prizepicks", american: null, url: null }],
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

describe("filterWnbaPropBoardRows", () => {
  it("filters by team and player substring", () => {
    const rows = [
      row({}),
      row({ player_name: "Rhyne Howard", team_abbrev: "ATL" }),
    ];
    const out = filterWnbaPropBoardRows(rows, {
      teams: new Set(["IND"]),
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
    expect(filterWnbaPropBoardRows(rows, { teams: new Set(), query: "" })).toEqual(
      rows,
    );
  });

  it("excludes rows with a null team when a team filter is active", () => {
    const noTeam = row({ player_name: "No Team", team_abbrev: null });
    expect(
      filterWnbaPropBoardRows([noTeam], { teams: new Set(["IND"]), query: "" }),
    ).toEqual([]);
  });

  it("trims the search query and matches case-insensitively", () => {
    const rows = [row({}), row({ player_name: "Rhyne Howard", team_abbrev: "ATL" })];
    expect(
      filterWnbaPropBoardRows(rows, { teams: new Set(), query: "  cLaRk  " }),
    ).toEqual([rows[0]]);
  });

  it("filters by proposition market (stat) and over/under side", () => {
    const rows = [
      row({ player_name: "Caitlin Clark", stat: "points", side: "over" }),
      row({
        player_name: "Caitlin Clark",
        stat: "points",
        side: "under",
        market_label: "Under 1.5 Points",
      }),
      row({
        player_name: "Shohei Ohtani",
        stat: "assists",
        side: "over",
        market_label: "Over 6.5 Assists",
        team_abbrev: "ATL",
      }),
    ];
    expect(
      filterWnbaPropBoardRows(rows, {
        teams: new Set(),
        query: "",
        markets: new Set(["points"]),
      }).map((r) => `${r.player_name}:${r.side}`),
    ).toEqual(["Caitlin Clark:over", "Caitlin Clark:under"]);
    expect(
      filterWnbaPropBoardRows(rows, {
        teams: new Set(),
        query: "",
        sides: new Set(["over"]),
      }).map((r) => `${r.player_name}:${r.stat}`),
    ).toEqual(["Caitlin Clark:points", "Shohei Ohtani:assists"]);
  });

  it("collects unique proposition options from market labels", () => {
    const options = collectWnbaBoardPropositionOptions([
      row({ stat: "points", market_label: "Over 18.5 Points" }),
      row({ stat: "points", market_label: "Under 4.5 Assists" }),
      row({
        stat: "assists",
        market_label: "Over 6.5 Assists",
      }),
    ]);
    expect(options).toEqual([
      { value: "assists", label: "Assists" },
      { value: "points", label: "Points" },
    ]);
  });

  it("filters by bookmaker and keeps only selected book chips", () => {
    const rows = [
      row({
        player_name: "Caitlin Clark",
        books: [
          { book: "prophetx", american: -115, url: null },
          { book: "draftkings", american: -120, url: null },
        ],
      }),
      row({
        player_name: "Rhyne Howard",
        team_abbrev: "ATL",
        books: [{ book: "fanduel", american: -108, url: null }],
      }),
    ];
    const out = filterWnbaPropBoardRows(rows, {
      teams: new Set(),
      query: "",
      books: new Set(["draftkings"]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].player_name).toBe("Caitlin Clark");
    expect(out[0].books.map((chip) => chip.book)).toEqual(["draftkings"]);
  });

  it("drops rows with no posted American odds", () => {
    const rows = [
      row({ player_name: "Caitlin Clark", books: [], dfs: [] }),
      row({
        player_name: "Juan Soto",
        books: [{ book: "fanduel", american: null, url: null }],
        dfs: [],
      }),
      row({
        player_name: "Rhyne Howard",
        books: [],
        dfs: [{ book: "prizepicks", american: null, url: null }],
      }),
      row({
        player_name: "Freddie Freeman",
        team_abbrev: "ATL",
        books: [{ book: "draftkings", american: -120, url: null }],
        dfs: [],
      }),
    ];
    expect(
      filterWnbaPropBoardRows(rows, { teams: new Set(), query: "" }).map(
        (r) => r.player_name,
      ),
    ).toEqual(["Rhyne Howard"]);
  });

  it("omits sportsbook-only rows with no PrizePicks or Underdog line", () => {
    const rows = [
      row({
        player_name: "Pinnacle Only",
        dfs: [],
        books: [{ book: "pinnacle", american: -108, url: null }],
      }),
      row({
        player_name: "Has DFS",
        dfs: [{ book: "underdog", american: -105, url: null }],
        books: [{ book: "pinnacle", american: -108, url: null }],
      }),
    ];
    expect(
      filterWnbaPropBoardRows(rows, { teams: new Set(), query: "" }).map(
        (r) => r.player_name,
      ),
    ).toEqual(["Has DFS"]);
  });

  it("keeps a sportsbook whose main line differs from the DFS line", () => {
    const rows = [
      row({
        line: 3.5,
        dfs: [{ book: "prizepicks", american: null, url: null }],
        books: [
          {
            book: "pinnacle",
            american: -128,
            url: null,
            line: 1.5,
            over_american: -128,
            under_american: -104,
          },
        ],
      }),
    ];
    expect(
      filterWnbaPropBoardRows(rows, { teams: new Set(), query: "" }).map(
        (r) => r.player_name,
      ),
    ).toEqual(["Caitlin Clark"]);
  });

  it("filters PrizePicks on dfs and clears Odds", () => {
    const rows = [
      row({
        player_name: "Caitlin Clark",
        dfs: [{ book: "prizepicks", american: null, url: null }],
        books: [{ book: "prophetx", american: -115, url: null }],
      }),
      row({
        player_name: "Rhyne Howard",
        team_abbrev: "ATL",
        dfs: [],
        books: [{ book: "draftkings", american: -120, url: null }],
      }),
    ];
    const out = filterWnbaPropBoardRows(rows, {
      teams: new Set(),
      query: "",
      books: new Set(["prizepicks"]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].player_name).toBe("Caitlin Clark");
    expect(out[0].dfs.map((chip) => chip.book)).toEqual(["prizepicks"]);
    expect(out[0].books).toEqual([]);
  });

  it("filters DraftKings on books and clears DFS", () => {
    const rows = [
      row({
        player_name: "Caitlin Clark",
        dfs: [{ book: "prizepicks", american: null, url: null }],
        books: [{ book: "draftkings", american: -120, url: null }],
      }),
    ];
    const out = filterWnbaPropBoardRows(rows, {
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
      collectWnbaBoardBookmakerOptions([
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
      { value: "prizepicks", label: "PrizePicks" },
      { value: "underdog", label: "Underdog" },
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
          game_id: 2,
          game_start_at: "2026-08-23T23:10:00Z",
        }),
        row({
          player_name: "Caitlin Clark",
          team_abbrev: "IND",
          opponent_abbrev: "NYL",
          home_away: "away",
          game_id: 1,
          game_start_at: "2026-08-23T20:10:00Z",
        }),
        row({
          player_name: "Dansby Swanson",
          team_abbrev: "CHC",
          opponent_abbrev: "MIL",
          home_away: "home",
          game_id: 3,
          game_start_at: "2026-08-23T17:10:00Z",
        }),
        row({
          player_name: "Juan Soto",
          team_abbrev: "IND",
          opponent_abbrev: "NYL",
          home_away: "away",
          game_id: 1,
          game_start_at: "2026-08-23T20:10:00Z",
        }),
        row({
          player_name: "No Game",
          game_id: null,
          team_abbrev: "CHC",
          opponent_abbrev: "MIL",
        }),
      ]),
    ).toEqual([
      { value: "3", label: "MIL @ CHC" },
      { value: "1", label: "IND @ NYL" },
      { value: "2", label: "ATL @ CHI" },
    ]);
  });

  it("filters by selected games and omits rows with no game when a game filter is active", () => {
    const rows = [
      row({ player_name: "Caitlin Clark", game_id: 1 }),
      row({
        player_name: "Rhyne Howard",
        team_abbrev: "ATL",
        game_id: 2,
      }),
      row({ player_name: "No Game", game_id: null }),
    ];
    expect(
      filterWnbaPropBoardRows(rows, {
        teams: new Set(),
        query: "",
        games: new Set(["1"]),
      }).map((r) => r.player_name),
    ).toEqual(["Caitlin Clark"]);
  });
});
