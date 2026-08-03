import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbLiveSituation } from "./MlbLiveSituation";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbLiveSituation", () => {
  it("renders the at-bat player name and stakes label", () => {
    render(<MlbLiveSituation detail={mlbLiveDetail} />);
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();
    expect(screen.getByText("On this pitch")).toBeInTheDocument();
  });
});
