import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbSeasonTeamStats } from "./MlbSeasonTeamStats";
import { mlbScheduledDetail } from "../lib/testFixtures";
import type { MlbSeasonTeamStatLine } from "../lib/types";

const nullRanks = {
  hrRank: null,
  rRank: null,
  hRank: null,
  avgRank: null,
  obpRank: null,
  slgRank: null,
  eraRank: null,
  soRank: null,
  bbRank: null,
} as const;

const awayLine: MlbSeasonTeamStatLine = {
  hr: 146,
  r: 578,
  h: 1003,
  avg: ".261",
  obp: ".339",
  slg: ".430",
  era: "3.71",
  so: 1019,
  bb: 350,
  ...nullRanks,
};

const homeLine: MlbSeasonTeamStatLine = {
  hr: 141,
  r: 560,
  h: 980,
  avg: ".255",
  obp: ".330",
  slg: ".420",
  era: "4.10",
  so: 990,
  bb: 400,
  ...nullRanks,
};

const detailWithSeasonStats = {
  ...mlbScheduledDetail,
  seasonTeamStats: { away: awayLine, home: homeLine },
};

describe("MlbSeasonTeamStats", () => {
  it("highlights ERA leader as lower-better", () => {
    render(<MlbSeasonTeamStats detail={detailWithSeasonStats} />);
    expect(screen.getByTestId("mlb-season-team-stats")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-season-stat-era-away")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-season-stat-bb-away")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-season-stat-so-away")).toBeInTheDocument();
  });

  it("shows team logo and abbrev in the header", () => {
    render(
      <MlbSeasonTeamStats
        detail={{
          ...detailWithSeasonStats,
          away: {
            ...detailWithSeasonStats.away,
            logoUrl: "https://example.com/wsh.svg",
          },
          home: {
            ...detailWithSeasonStats.home,
            logoUrl: "https://example.com/phi.svg",
          },
        }}
      />,
    );

    const section = screen.getByTestId("mlb-season-team-stats");
    expect(section.querySelector('img[src="https://example.com/wsh.svg"]')).toBeTruthy();
    expect(section.querySelector('img[src="https://example.com/phi.svg"]')).toBeTruthy();
    expect(screen.getByText("WSH")).toBeInTheDocument();
    expect(screen.getByText("PHI")).toBeInTheDocument();
  });

  it("shows league rank beside stat value when rank is present", () => {
    render(
      <MlbSeasonTeamStats
        detail={{
          ...detailWithSeasonStats,
          seasonTeamStats: {
            away: { ...awayLine, hrRank: 3 },
            home: homeLine,
          },
        }}
      />,
    );

    expect(screen.getByTestId("mlb-season-stat-hr-rank-away")).toHaveTextContent(
      "#3",
    );
  });

  it("omits rank label when rank is null", () => {
    render(<MlbSeasonTeamStats detail={detailWithSeasonStats} />);

    expect(
      screen.queryByTestId("mlb-season-stat-hr-rank-away"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("mlb-season-stat-hr-rank-home"),
    ).not.toBeInTheDocument();
  });

  it("hides when seasonTeamStats is null", () => {
    render(
      <MlbSeasonTeamStats
        detail={{ ...mlbScheduledDetail, seasonTeamStats: null }}
      />,
    );
    expect(screen.queryByTestId("mlb-season-team-stats")).not.toBeInTheDocument();
  });
});
