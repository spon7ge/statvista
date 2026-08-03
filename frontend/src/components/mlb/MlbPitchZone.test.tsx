import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbPitchZone } from "./MlbPitchZone";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbPitchZone", () => {
  it("renders pitch result labels from the situation", () => {
    render(<MlbPitchZone situation={mlbLiveDetail.situation!} />);
    expect(screen.getByText(/Called Strike/i)).toBeInTheDocument();
  });
});
