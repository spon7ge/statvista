import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildScheduledDetail } from "../lib/testFixtures";
import type { GameDetailSeasonTeamStatLine } from "../lib/types";
import { NbaSeasonTeamStats } from "./NbaSeasonTeamStats";

const line: GameDetailSeasonTeamStatLine = {
  pts: 110,
  fgPct: ".470",
  fg3Pct: ".360",
  ftPct: ".800",
  reb: 44,
  ast: 26,
  stl: 8,
  blk: 5,
  to: 13,
  ptsRank: null,
  fgPctRank: null,
  fg3PctRank: null,
  ftPctRank: null,
  rebRank: null,
  astRank: null,
  stlRank: null,
  blkRank: null,
  toRank: null,
  efgPct: "54.0",
  tsPct: "58.1",
  defRtg: "110.4",
  defRtgRank: 4,
};

describe("NbaSeasonTeamStats", () => {
  it("places cached advanced stats after FT% and before counting rebounds", () => {
    const scheduled = buildScheduledDetail({ league: "nba" });
    render(
      <NbaSeasonTeamStats
        detail={{
          ...scheduled,
          seasonTeamStats: { away: line, home: line },
        }}
      />,
    );

    const text = screen.getByTestId("nba-season-team-stats").textContent ?? "";
    const ft = text.indexOf("FT%");
    const efg = text.indexOf("EFG%");
    const ts = text.indexOf("TS%");
    const rebPct = text.indexOf("REB%");
    const countingReb = text.indexOf("REB", rebPct + "REB%".length);
    expect(ft).toBeLessThan(efg);
    expect(efg).toBeLessThan(ts);
    expect(ts).toBeLessThan(rebPct);
    expect(rebPct).toBeLessThan(countingReb);
    expect(text).toContain("54.0");
    expect(text).toContain("58.1");
    expect(screen.getByTestId("nba-season-stat-defRtg-rank-away")).toHaveTextContent(
      "#4",
    );
    expect(text).not.toContain("USG%");
  });
});
