import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MlbPropPicksHeader } from "./MlbPropPicksHeader";

describe("MlbPropPicksHeader", () => {
  it("places MLB Props top-left and PrizePicks / Underdog tabs without legs or format pills", async () => {
    const user = userEvent.setup();
    const onAppChange = vi.fn();
    render(
      <MlbPropPicksHeader activeApp="prizepicks" onAppChange={onAppChange} />,
    );

    const heading = screen.getByRole("heading", { name: "MLB Props" });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-left");

    const prize = screen.getByRole("tab", { name: "PrizePicks" });
    const underdog = screen.getByRole("tab", { name: "Underdog" });
    expect(prize).toHaveAttribute("aria-selected", "true");
    expect(underdog).toHaveAttribute("aria-selected", "false");

    await user.click(underdog);
    expect(onAppChange).toHaveBeenCalledWith("underdog");

    expect(screen.queryByText(/-pick/)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Legs" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "More legs" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Fewer legs" }),
    ).not.toBeInTheDocument();
  });

  it("renders children in the banner slot", () => {
    render(
      <MlbPropPicksHeader activeApp="prizepicks" onAppChange={vi.fn()}>
        <span>Team filter</span>
      </MlbPropPicksHeader>,
    );
    expect(screen.getByText("Team filter")).toBeInTheDocument();
  });
});
