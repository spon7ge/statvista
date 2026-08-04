import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbBoxScore } from "./MlbBoxScore";
import { mlbFinalDetail, mlbLiveDetail } from "./testFixtures";

describe("MlbBoxScore", () => {
  it("renders batter names from the box score", () => {
    render(<MlbBoxScore detail={mlbLiveDetail} />);
    expect(screen.getByText("Betts")).toBeInTheDocument();
  });

  it("stacks teams on mobile by default", () => {
    render(<MlbBoxScore detail={mlbLiveDetail} />);

    expect(screen.getByTestId("mlb-box-score-layout")).toHaveClass(
      "lg:grid-cols-2",
    );
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

  it("renders per-team boxes with batting notes and pitcher footnotes", () => {
    render(<MlbBoxScore detail={mlbFinalDetail} sideBySide />);

    expect(screen.getByTestId("mlb-box-team-away")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-box-team-home")).toBeInTheDocument();
    expect(screen.getByText("2B:")).toBeInTheDocument();
    expect(screen.getAllByText("Pitches-strikes:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ERA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Totals").length).toBeGreaterThan(0);
  });

  it("appends pitcher decision to the name", () => {
    render(<MlbBoxScore detail={mlbFinalDetail} />);
    expect(screen.getByText("(W, 12-6)")).toBeInTheDocument();
  });
});
