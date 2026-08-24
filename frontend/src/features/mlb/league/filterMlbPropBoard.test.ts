import { describe, expect, it } from "vitest";
import { filterMlbPropBoardRows } from "./filterMlbPropBoard";
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
    books: [],
    ip_pct: 53,
    opp_def_rank: 2,
    opp_def_label: "2nd BOS",
    opp_pace_rank: 5,
    opp_pace_label: "5th BOS",
    hit_l5: 60,
    hit_l10: 50,
    hit_l15: 40,
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
});
