import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbPregameBroadcastHeader } from "./MlbPregameBroadcastHeader";
import { mlbScheduledDetail } from "./testFixtures";

describe("MlbPregameBroadcastHeader", () => {
  it("renders date, start time, records, last-10, and share", () => {
    render(
      <MlbPregameBroadcastHeader
        detail={mlbScheduledDetail}
        activeTab="preview"
        onTabChange={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("mlb-pregame-broadcast-header"),
    ).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText(/3:40 PM/i)).toBeInTheDocument();
    expect(screen.getByText("Washington Nationals")).toBeInTheDocument();
    expect(screen.getByText("Philadelphia Phillies")).toBeInTheDocument();
    expect(screen.getByText("55-59")).toBeInTheDocument();
    expect(screen.getByText("60-53")).toBeInTheDocument();
    expect(screen.getByText("0-5 in Last 10")).toBeInTheDocument();
    expect(screen.getByText("3-2 in Last 10")).toBeInTheDocument();
    expect(screen.getByLabelText(/share/i)).toBeInTheDocument();
  });

  it("renders Preview and team-name tabs", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <MlbPregameBroadcastHeader
        detail={mlbScheduledDetail}
        activeTab="preview"
        onTabChange={onTabChange}
      />,
    );
    expect(
      screen.getByRole("tab", { name: /preview/i }),
    ).toHaveAttribute("aria-selected", "true");
    await user.click(
      screen.getByRole("tab", { name: /philadelphia phillies/i }),
    );
    expect(onTabChange).toHaveBeenCalledWith("home");
  });

  it("omits record and last-10 lines when null", () => {
    const detail = {
      ...mlbScheduledDetail,
      away: { ...mlbScheduledDetail.away, record: null, last10: null },
      home: { ...mlbScheduledDetail.home, record: null, last10: null },
    };
    render(
      <MlbPregameBroadcastHeader
        detail={detail}
        activeTab="preview"
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/in Last 10/i)).not.toBeInTheDocument();
    expect(screen.queryByText("55-59")).not.toBeInTheDocument();
  });
});
