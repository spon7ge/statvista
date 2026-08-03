import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbWinProbability } from "./MlbWinProbability";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbWinProbability", () => {
  it("shows unavailable message when win probability is null", () => {
    render(
      <MlbWinProbability
        detail={{ ...mlbLiveDetail, winProbability: null }}
      />,
    );
    expect(screen.getByText("Game flow")).toBeInTheDocument();
    expect(
      screen.getByText("Win probability unavailable"),
    ).toBeInTheDocument();
  });

  it("renders a chart when win probability points are present", () => {
    render(<MlbWinProbability detail={mlbLiveDetail} />);
    expect(screen.getByText("Game flow")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Win probability chart"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Win probability unavailable"),
    ).not.toBeInTheDocument();
  });
});
