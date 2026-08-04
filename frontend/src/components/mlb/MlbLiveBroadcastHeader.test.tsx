import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbLiveBroadcastHeader } from "./MlbLiveBroadcastHeader";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbLiveBroadcastHeader", () => {
  it("renders split scores and status", () => {
    render(<MlbLiveBroadcastHeader detail={mlbLiveDetail} />);
    expect(screen.getByTestId("mlb-broadcast-header")).toBeInTheDocument();
    expect(
      screen.getByText(String(mlbLiveDetail.away.score)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(String(mlbLiveDetail.home.score)),
    ).toBeInTheDocument();
    expect(screen.getByText(mlbLiveDetail.statusLabel)).toBeInTheDocument();
  });
});
