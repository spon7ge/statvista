import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbBoxScore } from "./MlbBoxScore";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbBoxScore", () => {
  it("renders batter names from the box score", () => {
    render(<MlbBoxScore detail={mlbLiveDetail} />);
    expect(screen.getByText("Betts")).toBeInTheDocument();
  });

  it("stacks teams on mobile by default", () => {
    render(<MlbBoxScore detail={mlbLiveDetail} />);

    expect(
      screen.getByTestId("mlb-box-score-layout"),
    ).toHaveClass("lg:grid-cols-2");
    expect(screen.getByTestId("mlb-box-score-layout")).not.toHaveClass(
      "grid-cols-2",
    );
  });

  it("keeps teams side by side when requested", () => {
    render(<MlbBoxScore detail={mlbLiveDetail} sideBySide />);

    expect(screen.getByTestId("mlb-box-score-layout")).toHaveClass(
      "grid-cols-2",
    );
  });
});
