import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbBoxScore } from "./MlbBoxScore";
import { mlbFinalDetail, mlbLiveDetail } from "../lib/testFixtures";

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
    expect(screen.getByTestId("mlb-box-score-layout")).toHaveClass(
      "items-start",
    );
  });

  it("renders team abbrev headers and Batters/Pitchers column labels", () => {
    render(<MlbBoxScore detail={mlbFinalDetail} sideBySide />);

    expect(screen.getByText("ARI")).toBeInTheDocument();
    expect(screen.getByText("LAD")).toBeInTheDocument();
    expect(screen.getAllByText("Batters").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pitchers").length).toBeGreaterThan(0);
    expect(screen.queryByText("Box score")).not.toBeInTheDocument();
    expect(screen.queryByText("Player")).not.toBeInTheDocument();
    expect(screen.queryByText("Pitcher")).not.toBeInTheDocument();
  });

  it("renders per-team boxes with batting notes and pitcher footnotes", () => {
    render(<MlbBoxScore detail={mlbFinalDetail} sideBySide />);

    expect(screen.getByTestId("mlb-box-team-away")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-box-team-home")).toBeInTheDocument();
    expect(screen.getByText("2B:")).toBeInTheDocument();
    expect(screen.getAllByText("Pitches-strikes:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Batters faced:").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Inherited runners-scored:"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("ERA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Totals").length).toBeGreaterThan(0);
  });

  it("appends pitcher decision to the name", () => {
    render(<MlbBoxScore detail={mlbFinalDetail} />);
    expect(screen.getByText("(W, 12-6)")).toBeInTheDocument();
  });
});
