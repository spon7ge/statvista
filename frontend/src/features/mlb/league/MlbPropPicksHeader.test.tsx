import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MlbPropPicksHeader } from "./MlbPropPicksHeader";

describe("MlbPropPicksHeader", () => {
  it("places MLB Props top-left and exposes PrizePicks / Underdog tabs plus legs pill", async () => {
    const user = userEvent.setup();
    const onAppChange = vi.fn();
    const onLegsChange = vi.fn();
    render(
      <MlbPropPicksHeader
        activeApp="prizepicks"
        onAppChange={onAppChange}
        legs={4}
        onLegsChange={onLegsChange}
      />,
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

    expect(screen.getByText("4-pick")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More legs" }));
    expect(onLegsChange).toHaveBeenCalledWith(5);
  });
});
