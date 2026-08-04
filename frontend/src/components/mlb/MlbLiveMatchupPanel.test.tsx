import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbLiveMatchupPanel } from "./MlbLiveMatchupPanel";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbLiveMatchupPanel", () => {
  it("renders batter/pitcher names and count", () => {
    render(<MlbLiveMatchupPanel detail={mlbLiveDetail} />);
    expect(screen.getByTestId("mlb-live-matchup")).toBeInTheDocument();
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();
    expect(screen.getByText("Chris Sale")).toBeInTheDocument();
    expect(screen.getByText("2 - 1")).toBeInTheDocument();
    expect(screen.getByText(/\.280 · 0-0 today/)).toBeInTheDocument();
    expect(screen.getByText(/LHP/)).toBeInTheDocument();
    expect(
      screen.getByText(/6 P · 0\.1 IP, 0 ER, 6 K, 0 BB/),
    ).toBeInTheDocument();
    expect(screen.queryByText("CALL VALUE")).not.toBeInTheDocument();
  });

  it("shows outs dots and runner diamond", () => {
    render(<MlbLiveMatchupPanel detail={mlbLiveDetail} />);
    expect(
      screen.getByLabelText(/Runners: first on, second empty, third empty/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/1 outs/i)).toBeInTheDocument();
  });

  it("shows unavailable when situation is missing", () => {
    render(
      <MlbLiveMatchupPanel
        detail={{ ...mlbLiveDetail, situation: null }}
      />,
    );
    expect(screen.getByText(/matchup unavailable/i)).toBeInTheDocument();
  });
});
