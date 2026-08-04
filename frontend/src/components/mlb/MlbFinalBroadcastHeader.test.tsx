import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbFinalBroadcastHeader } from "./MlbFinalBroadcastHeader";
import { mlbFinalDetail } from "./testFixtures";

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

  it("renders the centered Summary and Box tabs and changes tabs", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <MlbFinalBroadcastHeader
        detail={mlbFinalDetail}
        activeTab="summary"
        onTabChange={onTabChange}
      />,
    );

    expect(
      screen.getByRole("tablist", { name: /final game details/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /summary/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("tab", { name: /box/i }));

    expect(onTabChange).toHaveBeenCalledWith("box");
  });
});
