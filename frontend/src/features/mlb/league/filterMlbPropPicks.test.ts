import { describe, expect, it } from "vitest";
import type { ApiMlbPropRow } from "@/shared/lib/api";
import {
  collectMlbStatOptions,
  collectMlbTeamOptions,
  filterMlbPropPicks,
  type MlbPropFilterSelection,
} from "./filterMlbPropPicks";

function row(partial: Partial<ApiMlbPropRow> & Pick<ApiMlbPropRow, "player_name">): ApiMlbPropRow {
  return {
    team_abbrev: null,
    stat: "Total Bases",
    line: 1.5,
    recommended_side: "over",
    fair_pct: 58.2,
    edge_pct: 5.1,
    alt_edge_pct: -2.4,
    source_tier: "sharp_consensus",
    confidence_chips: [],
    sample_chips: [],
    recency_chip: null,
    books: {
      prophetx: null,
      novig: null,
      draftkings: null,
      fanduel: null,
      pinnacle: null,
      caesars: null,
      kalshi: null,
      bet365: null,
      betmgm: null,
      fanatics: null,
      hardrock: null,
      fliff: null,
    },
    dfs: {
      line: 1.5,
      changed_at: null,
      american: null,
      payout_multiplier: null,
    },
    fair_explain: "PX+Novig agree within 2pp; 60/40 blend.",
    ...partial,
  };
}

function emptySelection(): MlbPropFilterSelection {
  return {
    stats: new Set(),
    teams: new Set(),
    sides: new Set(),
  };
}

describe("filterMlbPropPicks", () => {
  const judge = row({
    player_name: "Aaron Judge",
    team_abbrev: "NYY",
    stat: "Total Bases",
    recommended_side: "over",
    source_tier: "sharp_consensus",
    recency_chip: "fresh_sharp_vs_stale_dfs",
  });
  const betts = row({
    player_name: "Mookie Betts",
    team_abbrev: "LAD",
    stat: "Hits",
    recommended_side: "under",
    source_tier: "no_sharp_read",
    fair_pct: null,
    edge_pct: null,
    recency_chip: null,
  });
  const props = [judge, betts];

  it("returns all rows when no filters are active", () => {
    expect(filterMlbPropPicks(props, emptySelection())).toEqual(props);
  });

  it("filters by stat", () => {
    const result = filterMlbPropPicks(props, {
      ...emptySelection(),
      stats: new Set(["Hits"]),
    });
    expect(result).toEqual([betts]);
  });

  it("filters by team", () => {
    const result = filterMlbPropPicks(props, {
      ...emptySelection(),
      teams: new Set(["NYY"]),
    });
    expect(result).toEqual([judge]);
  });

  it("excludes rows with a null team when a team filter is active", () => {
    const noTeam = row({ player_name: "No Team", team_abbrev: null });
    const result = filterMlbPropPicks([noTeam], {
      ...emptySelection(),
      teams: new Set(["NYY"]),
    });
    expect(result).toEqual([]);
  });

  it("filters by recommended side", () => {
    const result = filterMlbPropPicks(props, {
      ...emptySelection(),
      sides: new Set(["under"]),
    });
    expect(result).toEqual([betts]);
  });

  it("ignores source_tier and recency_chip (no tier / fresh-vs-stale filters)", () => {
    const selection = emptySelection();
    expect(selection).toEqual({
      stats: expect.any(Set),
      teams: expect.any(Set),
      sides: expect.any(Set),
    });
    expect(selection).not.toHaveProperty("tiers");
    expect(selection).not.toHaveProperty("freshVsStaleOnly");
    // Mixed tiers/recency still all pass when only stats/teams/sides are empty
    expect(filterMlbPropPicks(props, selection)).toEqual(props);
  });

  it("combines multiple active filters with AND semantics", () => {
    const result = filterMlbPropPicks(props, {
      ...emptySelection(),
      stats: new Set(["Total Bases"]),
      teams: new Set(["NYY"]),
      sides: new Set(["over"]),
    });
    expect(result).toEqual([judge]);
  });

  it("never reorders rows (API already sorts)", () => {
    const reversedInput = [betts, judge];
    expect(filterMlbPropPicks(reversedInput, emptySelection())).toEqual([
      betts,
      judge,
    ]);
  });
});

describe("collectMlbStatOptions", () => {
  it("returns unique, sorted stat names", () => {
    const props = [
      row({ player_name: "A", stat: "Hits" }),
      row({ player_name: "B", stat: "Total Bases" }),
      row({ player_name: "C", stat: "Hits" }),
    ];
    expect(collectMlbStatOptions(props)).toEqual(["Hits", "Total Bases"]);
  });
});

describe("collectMlbTeamOptions", () => {
  it("returns unique, sorted team abbrevs and skips null", () => {
    const props = [
      row({ player_name: "A", team_abbrev: "NYY" }),
      row({ player_name: "B", team_abbrev: "LAD" }),
      row({ player_name: "C", team_abbrev: null }),
      row({ player_name: "D", team_abbrev: "NYY" }),
    ];
    expect(collectMlbTeamOptions(props)).toEqual(["LAD", "NYY"]);
  });
});
