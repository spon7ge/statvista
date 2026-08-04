import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbFinalTeamStats } from "./MlbFinalTeamStats";
import { mlbFinalDetail } from "./testFixtures";

describe("MlbFinalTeamStats", () => {
  it("renders all comparison rows and marks their leaders", () => {
    render(<MlbFinalTeamStats detail={mlbFinalDetail} />);

    expect(screen.getByTestId("mlb-final-team-stats")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Team Stats" })).toBeInTheDocument();
    expect(screen.queryByText("STAT")).not.toBeInTheDocument();
    expect(screen.getByText("AVG")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-team-stat-avg-home")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-team-stat-k-away")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-team-stat-era-home")).toBeInTheDocument();
  });

  it("does not mark a leader for tied, missing, or invalid values", () => {
    render(
      <MlbFinalTeamStats
        detail={{
          ...mlbFinalDetail,
          teamStats: {
            away: { ...mlbFinalDetail.teamStats!.away, hr: 1, era: "bad" },
            home: { ...mlbFinalDetail.teamStats!.home, hr: 1, era: "3.20" },
          },
        }}
      />,
    );

    expect(screen.queryByTestId("mlb-team-stat-hr-away")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-team-stat-hr-home")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-team-stat-era-away")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-team-stat-era-home")).not.toBeInTheDocument();
  });
});
