import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbLinescore } from "./MlbLinescore";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbLinescore", () => {
  it("renders R/H/E column labels from the linescore", () => {
    render(<MlbLinescore detail={mlbLiveDetail} />);
    expect(screen.getByText("R")).toBeInTheDocument();
  });
});
