import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbPregameBroadcastHeader } from "./MlbPregameBroadcastHeader";
import { mlbScheduledDetail } from "../lib/testFixtures";

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
    const tablist = screen.getByRole("tablist");
    expect(
      screen.getByTestId("mlb-pregame-slab-away"),
    ).toHaveTextContent("Washington Nationals");
    expect(
      screen.getByTestId("mlb-pregame-slab-home"),
    ).toHaveTextContent("Philadelphia Phillies");
    expect(
      screen.getByRole("tab", { name: "Washington Nationals" }),
    ).toHaveTextContent("Washington Nationals");
    expect(
      screen.getByRole("tab", { name: "Philadelphia Phillies" }),
    ).toHaveTextContent("Philadelphia Phillies");
    expect(tablist).toHaveTextContent("Washington Nationals");
    expect(tablist).toHaveTextContent("Philadelphia Phillies");
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
    const tablist = screen.getByRole("tablist");
    const previewTab = screen.getByRole("tab", { name: "Preview" });
    expect(previewTab).toHaveAttribute("aria-selected", "true");
    expect(previewTab).toHaveTextContent("Preview");

    const awayTab = screen.getByRole("tab", { name: "Washington Nationals" });
    const homeTab = screen.getByRole("tab", {
      name: "Philadelphia Phillies",
    });
    expect(awayTab).toHaveTextContent("Washington Nationals");
    expect(homeTab).toHaveTextContent("Philadelphia Phillies");
    expect(tablist).toHaveTextContent("Washington Nationals");
    expect(tablist).toHaveTextContent("Philadelphia Phillies");

    await user.click(homeTab);
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
