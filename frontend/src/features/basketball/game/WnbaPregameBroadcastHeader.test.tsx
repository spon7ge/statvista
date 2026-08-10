import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WnbaPregameBroadcastHeader } from "./WnbaPregameBroadcastHeader";
import { buildScheduledDetail } from "../lib/testFixtures";

const detail = buildScheduledDetail({
  away: {
    id: "away1",
    abbrev: "MIN",
    name: "Minnesota Lynx",
    score: null,
    record: "22-8",
    last10: "7-3",
    color: "#236192",
    logoUrl: null,
  },
  home: {
    id: "home1",
    abbrev: "TOR",
    name: "Toronto Tempo",
    score: null,
    record: "15-14",
    last10: "4-6",
    color: "#B4975A",
    logoUrl: null,
  },
});

describe("WnbaPregameBroadcastHeader", () => {
  it("shows record and last 10 on both slabs", () => {
    render(
      <WnbaPregameBroadcastHeader
        detail={detail}
        activeTab="preview"
        onTabChange={() => {}}
      />,
    );
    expect(screen.getByText("22-8")).toBeInTheDocument();
    expect(screen.getByText("15-14")).toBeInTheDocument();
    expect(screen.getByText(/7-3 in Last 10/)).toBeInTheDocument();
    expect(screen.getByText(/4-6 in Last 10/)).toBeInTheDocument();
  });

  it("centers Preview Away Home Props tabs", () => {
    render(
      <WnbaPregameBroadcastHeader
        detail={detail}
        activeTab="preview"
        onTabChange={() => {}}
      />,
    );
    const tablist = screen.getByRole("tablist");
    expect(tablist).toHaveClass(/justify-center/);
    expect(screen.getByRole("tab", { name: "Preview" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Minnesota Lynx" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Toronto Tempo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Props" })).toBeInTheDocument();
  });

  it("calls onTabChange for Props tab", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <WnbaPregameBroadcastHeader
        detail={detail}
        activeTab="preview"
        onTabChange={onTabChange}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Props" }));
    expect(onTabChange).toHaveBeenCalledWith("props");
  });

  it("omits record and last-10 lines when null", () => {
    const withoutForm = buildScheduledDetail({
      away: { ...detail.away, record: null, last10: null },
      home: { ...detail.home, record: null, last10: null },
    });
    render(
      <WnbaPregameBroadcastHeader
        detail={withoutForm}
        activeTab="preview"
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/in Last 10/i)).not.toBeInTheDocument();
    expect(screen.queryByText("22-8")).not.toBeInTheDocument();
  });
});
