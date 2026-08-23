import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { appFromSearch, WnbaPropPicksHeader } from "./WnbaPropPicksHeader";

describe("appFromSearch", () => {
  it("defaults to prizepicks and accepts underdog", () => {
    expect(appFromSearch(null)).toBe("prizepicks");
    expect(appFromSearch("prizepicks")).toBe("prizepicks");
    expect(appFromSearch("underdog")).toBe("underdog");
    expect(appFromSearch("other")).toBe("prizepicks");
  });
});

describe("WnbaPropPicksHeader", () => {
  it("places WNBA Props on the left without a green banner", async () => {
    const user = userEvent.setup();
    const onAppChange = vi.fn();
    render(
      <WnbaPropPicksHeader activeApp="prizepicks" onAppChange={onAppChange} />,
    );

    const heading = screen.getByRole("heading", { name: "WNBA Props" });
    expect(heading).toHaveClass("text-left");
    expect(
      screen.getByTestId("wnba-prop-picks-header").querySelector("div.rounded-3xl"),
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

  it("keeps tab ids for panels", () => {
    render(
      <WnbaPropPicksHeader activeApp="prizepicks" onAppChange={vi.fn()} />,
    );

    expect(screen.getByRole("tab", { name: "PrizePicks" })).toHaveAttribute(
      "id",
      "wnba-props-prizepicks-tab",
    );
    expect(screen.getByRole("tab", { name: "Underdog" })).toHaveAttribute(
      "aria-controls",
      "wnba-props-underdog-panel",
    );
  });

  it("renders children to the right of the title", () => {
    render(
      <WnbaPropPicksHeader activeApp="prizepicks" onAppChange={vi.fn()}>
        <span>Team filter</span>
      </WnbaPropPicksHeader>,
    );
    expect(screen.getByText("Team filter")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "WNBA Props" })).toBeInTheDocument();
  });
});
