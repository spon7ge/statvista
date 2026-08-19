import { describe, expect, it } from "vitest";
import type { WnbaPropPlayerCard } from "./groupWnbaPropPlayers";
import { slugifyPlayerName } from "./groupWnbaPropPlayers";
import {
  excludePastGameProps,
  filterWnbaPropPicks,
  filterWnbaPropPlayers,
} from "./filterWnbaPropPicks";

const row = {
  player_name: "A",
  team_abbrev: "PHO",
  stat: "Points",
  recommended_side: "over",
  commence_time: "2026-08-11T23:00:00Z",
} as const;

describe("filterWnbaPropPicks", () => {
  it("filters by recommended side not a raw side field", () => {
    const out = filterWnbaPropPicks([row as never], {
      stats: new Set(),
      teams: new Set(),
      sides: new Set(["under"]),
    });
    expect(out).toHaveLength(0);
  });
});

describe("excludePastGameProps", () => {
  it("drops final teams and keeps live", () => {
    const games = [
      { status: "final", home: { abbrev: "PHO" }, away: { abbrev: "LAS" } },
      { status: "live", home: { abbrev: "NYL" }, away: { abbrev: "ATL" } },
    ] as never;
    const rows = [
      { ...row, team_abbrev: "PHO" },
      { ...row, team_abbrev: "NYL", player_name: "B" },
    ] as never;
    const out = excludePastGameProps(rows, games, "2026-08-11");
    expect(out.map((r) => r.team_abbrev)).toEqual(["NYL"]);
  });

  it("drops prior-day tips", () => {
    const rows = [
      { ...row, commence_time: "2026-08-10T23:00:00Z" },
    ] as never;
    const out = excludePastGameProps(rows, [], "2026-08-11");
    expect(out).toHaveLength(0);
  });
});

function playerCard(
  partial: Partial<WnbaPropPlayerCard> & Pick<WnbaPropPlayerCard, "player_name">,
): WnbaPropPlayerCard {
  return {
    player_slug: slugifyPlayerName(partial.player_name),
    prop_count: 1,
    team_abbrev: null,
    position: null,
    headshot_url: null,
    stats: ["Points"],
    rows: [],
    ...partial,
  };
}

describe("filterWnbaPropPlayers", () => {
  const howard = playerCard({
    player_name: "Rhyne Howard",
    team_abbrev: "ATL",
    prop_count: 2,
  });
  const loyd = playerCard({
    player_name: "Jewell Loyd",
    team_abbrev: "SEA",
    prop_count: 1,
  });
  const players = [howard, loyd];

  it("returns all players when no filters are active", () => {
    expect(filterWnbaPropPlayers(players, { teams: new Set(), query: "" })).toEqual(
      players,
    );
  });

  it("filters by team", () => {
    expect(
      filterWnbaPropPlayers(players, { teams: new Set(["ATL"]), query: "" }),
    ).toEqual([howard]);
  });

  it("excludes players with a null team when a team filter is active", () => {
    const noTeam = playerCard({ player_name: "No Team", team_abbrev: null });
    expect(
      filterWnbaPropPlayers([noTeam], { teams: new Set(["ATL"]), query: "" }),
    ).toEqual([]);
  });

  it("filters by player name query case-insensitively", () => {
    expect(
      filterWnbaPropPlayers(players, { teams: new Set(), query: "hOwArD" }),
    ).toEqual([howard]);
  });

  it("trims the search query", () => {
    expect(
      filterWnbaPropPlayers(players, { teams: new Set(), query: "  loyd  " }),
    ).toEqual([loyd]);
  });

  it("combines team and name query with AND semantics", () => {
    expect(
      filterWnbaPropPlayers(players, { teams: new Set(["SEA"]), query: "howard" }),
    ).toEqual([]);
    expect(
      filterWnbaPropPlayers(players, { teams: new Set(["ATL"]), query: "rhyne" }),
    ).toEqual([howard]);
  });

  it("never reorders players", () => {
    expect(
      filterWnbaPropPlayers([loyd, howard], { teams: new Set(), query: "" }),
    ).toEqual([loyd, howard]);
  });
});
