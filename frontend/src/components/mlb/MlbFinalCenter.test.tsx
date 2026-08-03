import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbFinalCenter } from "./MlbFinalCenter";
import { mlbLiveDetail } from "./testFixtures";

const finalDetail = {
  ...mlbLiveDetail,
  status: "final" as const,
  statusLabel: "Final",
};

describe("MlbFinalCenter", () => {
  it("renders header, linescore, box score, then archive trio", () => {
    render(<MlbFinalCenter detail={finalDetail} />);
    const root = screen.getByTestId("mlb-final-center");
    expect(root).toBeInTheDocument();

    expect(screen.getByTestId("mlb-box-score")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-flow")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-chart")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-scoring-plays")).toBeInTheDocument();

    expect(screen.queryByTestId("mlb-play-by-play")).not.toBeInTheDocument();
  });
});
