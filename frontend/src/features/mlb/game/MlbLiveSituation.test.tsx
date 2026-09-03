import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbLiveSituation } from "./MlbLiveSituation";
import { mlbLiveDetail } from "../lib/testFixtures";

describe("MlbLiveSituation", () => {
  it("renders at-bat name and ESPN call value card from stakes", () => {
    render(<MlbLiveSituation detail={mlbLiveDetail} />);
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();
    expect(screen.getByText("CALL VALUE")).toBeInTheDocument();
    expect(screen.getByText("2.1 pts")).toBeInTheDocument();
    expect(screen.getByText("On this pitch")).toBeInTheDocument();
    expect(screen.getByText("home -2.1 pts")).toBeInTheDocument();
    expect(
      screen.getByText(/Data:\s*ESPN win probability/i),
    ).toBeInTheDocument();
  });

  it("uses compact count labels and on-deck line", () => {
    render(<MlbLiveSituation detail={mlbLiveDetail} />);
    expect(screen.getByText("Strk")).toBeInTheDocument();
    expect(screen.getByText("Out")).toBeInTheDocument();
    expect(screen.getByText(/ON DECK/i)).toBeInTheDocument();
    expect(screen.getByText(/Freddie Freeman/i)).toBeInTheDocument();
    expect(screen.getByText(/RHB · \.280 · 0-0 today/i)).toBeInTheDocument();
    expect(screen.getByText(/LHP · 6 P/i)).toBeInTheDocument();
  });

  it("renders only the pitch zone in pitchZone variant", () => {
    render(<MlbLiveSituation detail={mlbLiveDetail} variant="pitchZone" />);
    expect(screen.getByTestId("mlb-pitch-zone")).toBeInTheDocument();
    expect(screen.queryByText("CALL VALUE")).not.toBeInTheDocument();
    expect(screen.queryByText("AT BAT")).not.toBeInTheDocument();
  });

  it("fills ball count dots green and strike count dots red to match pitch markers", () => {
    render(<MlbLiveSituation detail={mlbLiveDetail} />);
    const markers = screen.getAllByTestId("mlb-pitch-marker");
    const ballFill = markers[0]?.getAttribute("fill");
    const strikeFill = markers[1]?.getAttribute("fill");
    expect(ballFill).toBe("rgba(74, 222, 128, 0.9)");
    expect(strikeFill).toBe("rgba(248, 113, 113, 0.9)");

    const filledBalls = filledCountDots("2 Balls");
    expect(filledBalls).toHaveLength(2);
    for (const dot of filledBalls) {
      expect(dot).toHaveStyle({ backgroundColor: ballFill });
    }

    const filledStrikes = filledCountDots("1 Strk");
    expect(filledStrikes).toHaveLength(1);
    expect(filledStrikes[0]).toHaveStyle({ backgroundColor: strikeFill });
  });
});

function filledCountDots(label: string): HTMLElement[] {
  const group = screen.getByLabelText(label);
  return [...group.querySelectorAll("span")].filter(
    (el) => !el.classList.contains("border"),
  );
}
