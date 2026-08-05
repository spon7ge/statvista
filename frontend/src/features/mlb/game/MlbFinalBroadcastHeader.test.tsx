import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbFinalBroadcastHeader } from "./MlbFinalBroadcastHeader";
import { mlbFinalDetail } from "../lib/testFixtures";

describe("MlbFinalBroadcastHeader", () => {
  it("renders Today, Final, records, and split scores", () => {
    render(
      <MlbFinalBroadcastHeader
        detail={mlbFinalDetail}
        activeTab="summary"
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("mlb-final-broadcast-header")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getByText("58-55")).toBeInTheDocument();
    expect(
      screen.getByText(String(mlbFinalDetail.away.score)),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/share/i)).toBeInTheDocument();
  });

  it("renders Summary and Box tabs under the score header", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <MlbFinalBroadcastHeader
        detail={mlbFinalDetail}
        activeTab="summary"
        onTabChange={onTabChange}
      />,
    );

    const header = screen.getByTestId("mlb-final-broadcast-header");
    const scoreRow = header.querySelector(".grid.grid-cols-2");
    const tablist = screen.getByRole("tablist", {
      name: /final game details/i,
    });
    expect(scoreRow).toBeTruthy();
    expect(
      scoreRow!.compareDocumentPosition(tablist) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.getByRole("tab", { name: /summary/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("tab", { name: /box/i }));
    expect(onTabChange).toHaveBeenCalledWith("box");
  });

  it("centers larger logos in each team score slab when logo URLs exist", () => {
    const detail = {
      ...mlbFinalDetail,
      away: {
        ...mlbFinalDetail.away,
        logoUrl: "https://example.com/away.svg",
      },
      home: {
        ...mlbFinalDetail.home,
        logoUrl: "https://example.com/home.svg",
      },
    };
    render(
      <MlbFinalBroadcastHeader
        detail={detail}
        activeTab="summary"
        onTabChange={vi.fn()}
      />,
    );

    const awayLogo = screen.getByTestId("mlb-final-logo-away");
    const homeLogo = screen.getByTestId("mlb-final-logo-home");
    expect(awayLogo).toHaveClass("justify-center");
    expect(homeLogo).toHaveClass("justify-center");
    expect(awayLogo.querySelector("img")).toHaveClass("size-28");
    expect(homeLogo.querySelector("img")).toHaveClass("size-28");
  });
});
