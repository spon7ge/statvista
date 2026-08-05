import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbScoringPlays } from "./MlbScoringPlays";
import { mlbLiveDetail } from "../lib/testFixtures";

describe("MlbScoringPlays", () => {
  it("renders scoring play text and score", () => {
    render(<MlbScoringPlays detail={mlbLiveDetail} />);
    expect(screen.getByTestId("mlb-scoring-plays")).toBeInTheDocument();
    expect(screen.getByText("Scoring plays")).toBeInTheDocument();
    expect(screen.getByText("Freeman homers (1)")).toBeInTheDocument();
    expect(screen.getByText("0-1")).toBeInTheDocument();
  });

  it("shows empty copy when there are no scoring plays", () => {
    render(
      <MlbScoringPlays detail={{ ...mlbLiveDetail, scoringPlays: [] }} />,
    );
    expect(screen.getByText("No scoring plays yet")).toBeInTheDocument();
  });
});
