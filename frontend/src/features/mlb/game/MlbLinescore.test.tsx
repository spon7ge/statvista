import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbLinescore } from "./MlbLinescore";
import { mlbFinalDetail, mlbLiveDetail } from "../lib/testFixtures";

describe("MlbLinescore", () => {
  it("renders R/H/E column labels from the linescore", () => {
    render(<MlbLinescore detail={mlbLiveDetail} />);
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("H")).toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  it("shows team abbrevs next to each row", () => {
    render(<MlbLinescore detail={mlbLiveDetail} />);
    expect(screen.getByText("BOS")).toBeInTheDocument();
    expect(screen.getByText("LAD")).toBeInTheDocument();
  });

  it("shows X for an unplayed home ninth in a final game", () => {
    render(
      <MlbLinescore
        detail={{
          ...mlbFinalDetail,
          linescore: {
            ...mlbFinalDetail.linescore!,
            innings: [
              ...mlbFinalDetail.linescore!.innings.filter((i) => i.num !== 9),
              { num: 9, awayRuns: 0, homeRuns: null },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText("X")).toBeInTheDocument();
  });
});
