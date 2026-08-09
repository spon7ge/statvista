import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbLiveBroadcastHeader } from "./MlbLiveBroadcastHeader";
import { mlbLiveDetail } from "../lib/testFixtures";

describe("MlbLiveBroadcastHeader", () => {
  it("renders date, live status with pulse, scores, records chrome, and tabs", () => {
    const onTabChange = vi.fn();
    render(
      <MlbLiveBroadcastHeader
        detail={mlbLiveDetail}
        activeTab="summary"
        onTabChange={onTabChange}
      />,
    );

    expect(screen.getByTestId("mlb-broadcast-header")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText(mlbLiveDetail.statusLabel)).toBeInTheDocument();
    expect(
      screen.getByText(String(mlbLiveDetail.away.score)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(String(mlbLiveDetail.home.score)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: /live game details/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /summary/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /boxscore/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-live-score-slab-away")).toHaveAttribute(
      "data-winner",
      "false",
    );
    expect(screen.queryByTestId("mlb-live-score-slab-home")).toHaveAttribute(
      "data-winner",
      "false",
    );
  });

  it("calls onTabChange when Boxscore is selected", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <MlbLiveBroadcastHeader
        detail={mlbLiveDetail}
        activeTab="summary"
        onTabChange={onTabChange}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /boxscore/i }));
    expect(onTabChange).toHaveBeenCalledWith("box");
  });
});
