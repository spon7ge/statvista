import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MlbMatchupPrediction } from "./MlbMatchupPrediction";
import { mlbScheduledDetail } from "../lib/testFixtures";

describe("MlbMatchupPrediction", () => {
  it("renders bar, percents, and source", () => {
    render(
      <MlbMatchupPrediction
        detail={{
          ...mlbScheduledDetail,
          matchupPrediction: {
            awayWinPct: 59,
            homeWinPct: 41,
            sourceLabel: "ESPN game projection",
          },
        }}
      />,
    );
    expect(screen.getByText("Matchup prediction")).toBeInTheDocument();
    expect(screen.getByText("59%")).toBeInTheDocument();
    expect(screen.getByText("41%")).toBeInTheDocument();
    expect(screen.getByText("ESPN game projection")).toBeInTheDocument();
    expect(screen.getByText("Matchup prediction").closest("section")).toHaveClass(
      "bg-[#3a3d42]",
    );
  });

  it("renders nothing without prediction", () => {
    const { container } = render(
      <MlbMatchupPrediction
        detail={{ ...mlbScheduledDetail, matchupPrediction: null }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
