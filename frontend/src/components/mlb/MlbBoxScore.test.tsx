import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbBoxScore } from "./MlbBoxScore";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbBoxScore", () => {
  it("renders batter names from the box score", () => {
    render(<MlbBoxScore detail={mlbLiveDetail} />);
    expect(screen.getByText("Betts")).toBeInTheDocument();
  });
});
