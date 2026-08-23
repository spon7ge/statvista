import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MlbPropPicksHeader } from "./MlbPropPicksHeader";

describe("MlbPropPicksHeader", () => {
  it("places MLB Props on the left without a green banner", async () => {
    const user = userEvent.setup();
    const onAppChange = vi.fn();
    render(
      <MlbPropPicksHeader activeApp="prizepicks" onAppChange={onAppChange} />,
    );

    const heading = screen.getByRole("heading", { name: "MLB Props" });
    expect(heading).toHaveClass("text-left");
    expect(
      screen.getByTestId("mlb-prop-picks-header").querySelector("div.rounded-3xl"),
    ).toBeNull();

    const prize = screen.getByRole("tab", { name: "PrizePicks" });
    const underdog = screen.getByRole("tab", { name: "Underdog" });
    expect(prize).toHaveAttribute("aria-selected", "true");
    expect(underdog).toHaveAttribute("aria-selected", "false");

    await user.click(underdog);
    expect(onAppChange).toHaveBeenCalledWith("underdog");

    expect(screen.queryByText(/-pick/)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Legs" })).not.toBeInTheDocument();
  });

  it("renders children to the right of the title", () => {
    render(
      <MlbPropPicksHeader activeApp="prizepicks" onAppChange={vi.fn()}>
        <span>Team filter</span>
      </MlbPropPicksHeader>,
    );
    expect(screen.getByText("Team filter")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MLB Props" })).toBeInTheDocument();
  });
});
