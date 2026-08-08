import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbWinProbability } from "./MlbWinProbability";
import { mlbLiveDetail } from "../lib/testFixtures";

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

  it("shows white enlarged team abbrev + pct labels", () => {
    render(<MlbWinProbability detail={mlbLiveDetail} />);
    const home = screen.getByTestId("mlb-game-flow-home-pct");
    const away = screen.getByTestId("mlb-game-flow-away-pct");
    expect(home).toHaveAttribute("fill", "#FFFFFF");
    expect(away).toHaveAttribute("fill", "#FFFFFF");
    expect(home).toHaveStyle({ fontSize: "18px" });
    expect(away).toHaveStyle({ fontSize: "18px" });
  });

  it("uses compact viewBox height when compact is set", () => {
    render(<MlbWinProbability detail={mlbLiveDetail} compact />);
    expect(screen.getByLabelText("Win probability chart")).toHaveAttribute(
      "viewBox",
      "0 0 640 168",
    );
  });

  it("uses default viewBox height without compact", () => {
    render(<MlbWinProbability detail={mlbLiveDetail} />);
    expect(screen.getByLabelText("Win probability chart")).toHaveAttribute(
      "viewBox",
      "0 0 640 520",
    );
  });
});
