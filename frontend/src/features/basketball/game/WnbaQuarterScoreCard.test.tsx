import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { detail } from "../lib/testFixtures";
import { WnbaQuarterScoreCard } from "./WnbaQuarterScoreCard";

describe("WnbaQuarterScoreCard", () => {
  it("renders period columns from derived quarter linescore", () => {
    render(<WnbaQuarterScoreCard detail={detail} />);

    expect(screen.getByTestId("wnba-quarter-score-card")).toBeInTheDocument();
    // Fixture scoring: P1 away 2 / home 0; P2 away 0 / home 3.
    expect(screen.getByRole("columnheader", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "T" })).toBeInTheDocument();
    expect(screen.getByText(detail.away.abbrev)).toBeInTheDocument();
    expect(screen.getByText(detail.home.abbrev)).toBeInTheDocument();
  });

  it("falls back to totals-only rows when linescore cannot be derived", () => {
    const noScoring = {
      ...detail,
      plays: detail.plays.map((play) => ({ ...play, scoring: false })),
    };
    render(<WnbaQuarterScoreCard detail={noScoring} />);

    expect(screen.getByTestId("wnba-quarter-score-card")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "1" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "T" })).toBeInTheDocument();
    expect(screen.getByText(String(detail.away.score))).toBeInTheDocument();
    expect(screen.getByText(String(detail.home.score))).toBeInTheDocument();
  });
});
