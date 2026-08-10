import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { detail } from "../lib/testFixtures";
import { WnbaBroadcastHeader } from "./WnbaBroadcastHeader";

describe("WnbaBroadcastHeader", () => {
  it("renders status above score slabs with Summary|Box tabs and no venue", () => {
    render(
      <WnbaBroadcastHeader
        detail={detail}
        activeTab="summary"
        onTabChange={() => {}}
      />,
    );

    expect(screen.getByText(detail.statusLabel)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /summary/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /box/i })).toBeInTheDocument();
    expect(screen.queryByText(detail.venue!)).not.toBeInTheDocument();

    const header = screen.getByTestId("wnba-broadcast-header");
    const status = screen.getByText(detail.statusLabel);
    const scoreRow = header.querySelector(".grid.grid-cols-2");
    const tablist = screen.getByRole("tablist");

    expect(scoreRow).toBeTruthy();
    // Status must appear above the score slabs.
    expect(
      status.compareDocumentPosition(scoreRow!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Tabs must appear under the score slabs.
    expect(
      scoreRow!.compareDocumentPosition(tablist) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders team abbrevs and scores in colored slabs", () => {
    render(
      <WnbaBroadcastHeader
        detail={detail}
        activeTab="summary"
        onTabChange={() => {}}
      />,
    );

    expect(screen.getByText(detail.away.abbrev)).toBeInTheDocument();
    expect(screen.getByText(detail.home.abbrev)).toBeInTheDocument();
    expect(screen.getByText(String(detail.away.score))).toBeInTheDocument();
    expect(screen.getByText(String(detail.home.score))).toBeInTheDocument();

    const awaySlab = screen.getByTestId("wnba-score-slab-away");
    const homeSlab = screen.getByTestId("wnba-score-slab-home");
    expect(awaySlab).toHaveStyle({ backgroundColor: "rgb(91, 44, 111)" });
    expect(homeSlab).toHaveStyle({ backgroundColor: "rgb(229, 96, 32)" });
  });

  it("calls onTabChange when Box tab is clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <WnbaBroadcastHeader
        detail={detail}
        activeTab="summary"
        onTabChange={onTabChange}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /box/i }));
    expect(onTabChange).toHaveBeenCalledWith("box");
  });

  it("omits Summary|Box tabs when tab props are not provided", () => {
    render(<WnbaBroadcastHeader detail={detail} />);

    expect(screen.getByTestId("wnba-broadcast-header")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
