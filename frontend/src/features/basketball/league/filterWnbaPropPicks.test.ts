import { describe, expect, it } from "vitest";
import {
  excludePastGameProps,
  filterWnbaPropPicks,
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
