import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildScheduledDetail } from "../lib/testFixtures";
import type { GameDetailSeasonTeamStatLine } from "../lib/types";
import { WnbaSeasonTeamStats } from "./WnbaSeasonTeamStats";

const nullRanks = {
  ptsRank: null,
  fgPctRank: null,
  fg3PctRank: null,
  ftPctRank: null,
  rebRank: null,
  astRank: null,
  stlRank: null,
  blkRank: null,
  toRank: null,
} as const;

const awayLine: GameDetailSeasonTeamStatLine = {
  pts: 92,
  fgPct: ".460",
  fg3Pct: ".350",
  ftPct: ".820",
  reb: 34,
  ast: 22,
  stl: 8,
  blk: 4,
  to: 13,
  ...nullRanks,
};

const homeLine: GameDetailSeasonTeamStatLine = {
  pts: 88,
  fgPct: ".440",
  fg3Pct: ".330",
  ftPct: ".790",
  reb: 36,
  ast: 20,
  stl: 7,
  blk: 5,
  to: 14,
  ...nullRanks,
};

const scheduled = buildScheduledDetail();

const detailWithSeasonStats = {
  ...scheduled,
  seasonTeamStats: { away: awayLine, home: homeLine },
};

describe("WnbaSeasonTeamStats", () => {
  it("renders basketball team stat labels", () => {
    render(<WnbaSeasonTeamStats detail={detailWithSeasonStats} />);
    expect(screen.getByTestId("wnba-season-team-stats")).toBeInTheDocument();
    for (const label of [
      "PTS",
      "FG%",
      "3P%",
      "FT%",
      "REB",
      "AST",
      "STL",
      "BLK",
      "TO",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("highlights TO leader as lower-better", () => {
    render(<WnbaSeasonTeamStats detail={detailWithSeasonStats} />);
    const toPill = screen.getByTestId("wnba-season-stat-to-away");
    expect(toPill).toHaveTextContent("13");
    expect(toPill).toHaveStyle({
      backgroundColor: detailWithSeasonStats.away.color,
    });
  });

  it("shows team logo and abbrev in the header", () => {
    render(
      <WnbaSeasonTeamStats
        detail={{
          ...detailWithSeasonStats,
          away: {
            ...detailWithSeasonStats.away,
            logoUrl: "https://example.com/min.svg",
          },
          home: {
            ...detailWithSeasonStats.home,
            logoUrl: "https://example.com/tor.svg",
          },
        }}
      />,
    );

    const section = screen.getByTestId("wnba-season-team-stats");
    expect(
      section.querySelector('img[src="https://example.com/min.svg"]'),
    ).toBeTruthy();
    expect(
      section.querySelector('img[src="https://example.com/tor.svg"]'),
    ).toBeTruthy();
    expect(screen.getByText("MIN")).toBeInTheDocument();
    expect(screen.getByText("TOR")).toBeInTheDocument();
  });

  it("shows league rank beside stat value when rank is present", () => {
    render(
      <WnbaSeasonTeamStats
        detail={{
          ...detailWithSeasonStats,
          seasonTeamStats: {
            away: { ...awayLine, ptsRank: 3 },
            home: homeLine,
          },
        }}
      />,
    );

    expect(
      screen.getByTestId("wnba-season-stat-pts-rank-away"),
    ).toHaveTextContent("#3");
  });

  it("omits rank label when rank is null", () => {
    render(<WnbaSeasonTeamStats detail={detailWithSeasonStats} />);

    expect(
      screen.queryByTestId("wnba-season-stat-pts-rank-away"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("wnba-season-stat-pts-rank-home"),
    ).not.toBeInTheDocument();
  });

  it("formats fractional averages to one decimal", () => {
    render(
      <WnbaSeasonTeamStats
        detail={{
          ...detailWithSeasonStats,
          seasonTeamStats: {
            away: { ...awayLine, pts: 88.21875, reb: 32.78125 },
            home: homeLine,
          },
        }}
      />,
    );
    expect(screen.getByText("88.2")).toBeInTheDocument();
    expect(screen.getByText("32.8")).toBeInTheDocument();
  });

  it("hides when seasonTeamStats is null", () => {
    render(
      <WnbaSeasonTeamStats
        detail={{ ...scheduled, seasonTeamStats: null }}
      />,
    );
    expect(
      screen.queryByTestId("wnba-season-team-stats"),
    ).not.toBeInTheDocument();
  });
});
