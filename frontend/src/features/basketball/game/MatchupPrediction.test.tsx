import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchupPrediction } from "./MatchupPrediction";
import { buildScheduledDetail } from "../lib/testFixtures";

describe("MatchupPrediction", () => {
  it("renders MLB-style pill with flanking team marks and no source line", () => {
    render(
      <MatchupPrediction
        detail={buildScheduledDetail({
          away: {
            id: "away1",
            abbrev: "MIN",
            name: "Minnesota Lynx",
            score: null,
            record: null,
            last10: null,
            color: "#236192",
            logoUrl: "https://example.com/min.png",
          },
          home: {
            id: "home1",
            abbrev: "TOR",
            name: "Toronto Tempo",
            score: null,
            record: null,
            last10: null,
            color: "#B4975A",
            logoUrl: "https://example.com/tor.png",
          },
          matchupPrediction: {
            awayWinPct: 67,
            homeWinPct: 33,
            sourceLabel: "ESPN game projection",
          },
        })}
      />,
    );

    expect(screen.getByTestId("wnba-matchup-prediction")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Matchup prediction" }),
    ).toHaveClass("text-center");
    expect(screen.getByTestId("wnba-matchup-prediction-pill")).toBeInTheDocument();
    expect(screen.getByText("MIN")).toBeInTheDocument();
    expect(screen.getByText("TOR")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(
      document.querySelector('img[src="https://example.com/min.png"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('img[src="https://example.com/tor.png"]'),
    ).toBeTruthy();
    expect(screen.queryByText("ESPN game projection")).not.toBeInTheDocument();
  });

  it("renders nothing without prediction", () => {
    const { container } = render(
      <MatchupPrediction
        detail={buildScheduledDetail({ matchupPrediction: null })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
