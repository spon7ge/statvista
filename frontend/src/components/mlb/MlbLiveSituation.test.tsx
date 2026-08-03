import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbLiveSituation } from "./MlbLiveSituation";
import { mlbLiveDetail } from "./testFixtures";

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
});
