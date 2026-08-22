import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbFinalTeamStats } from "./MlbFinalTeamStats";
import { mlbFinalDetail } from "../lib/testFixtures";

describe("MlbFinalTeamStats", () => {
  it("renders all comparison rows and marks their leaders", () => {
    render(<MlbFinalTeamStats detail={mlbFinalDetail} />);

    expect(screen.getByTestId("mlb-final-team-stats")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Team Stats" })).toBeInTheDocument();
    expect(screen.queryByText("STAT")).not.toBeInTheDocument();
    expect(screen.getByText("AVG")).toBeInTheDocument();

    const avgHome = screen.getByTestId("mlb-team-stat-avg-home");
    expect(avgHome).toHaveTextContent(".268");
    expect(avgHome).toHaveClass("rounded-full");
    expect(avgHome).toHaveStyle({ backgroundColor: mlbFinalDetail.home.color });

    const kAway = screen.getByTestId("mlb-team-stat-k-away");
    expect(kAway).toHaveTextContent("10");
    expect(kAway).toHaveClass("rounded-full");

    const eraHome = screen.getByTestId("mlb-team-stat-era-home");
    expect(eraHome).toHaveTextContent("3.20");
    expect(eraHome).toHaveClass("rounded-full");
  });

  it("shows white team abbrev and logo in the header", () => {
    render(
      <MlbFinalTeamStats
        detail={{
          ...mlbFinalDetail,
          away: {
            ...mlbFinalDetail.away,
            logoUrl: "https://example.com/ari.svg",
          },
          home: {
            ...mlbFinalDetail.home,
            logoUrl: "https://example.com/lad.svg",
          },
        }}
      />,
    );

    const section = screen.getByTestId("mlb-final-team-stats");
    const awayAbbrev = screen.getByText("ARI");
    const homeAbbrev = screen.getByText("LAD");
    expect(awayAbbrev).toHaveClass("text-white");
    expect(homeAbbrev).toHaveClass("text-white");
    expect(
      section.querySelector('img[src="https://example.com/ari.svg"]'),
    ).toBeTruthy();
    expect(
      section.querySelector('img[src="https://example.com/lad.svg"]'),
    ).toBeTruthy();
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
