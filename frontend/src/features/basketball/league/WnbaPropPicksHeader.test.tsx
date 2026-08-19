import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  appFromSearch,
  WNBA_PROP_PICKS_BANNER_EMERALD,
  WnbaPropPicksHeader,
} from "./WnbaPropPicksHeader";

describe("appFromSearch", () => {
  it("defaults to prizepicks and accepts underdog", () => {
    expect(appFromSearch(null)).toBe("prizepicks");
    expect(appFromSearch("prizepicks")).toBe("prizepicks");
    expect(appFromSearch("underdog")).toBe("underdog");
    expect(appFromSearch("other")).toBe("prizepicks");
  });
});

describe("WnbaPropPicksHeader", () => {
  it("places WNBA Props top-left and PrizePicks / Underdog tabs without legs or format pills", async () => {
    const user = userEvent.setup();
    const onAppChange = vi.fn();
    render(
      <WnbaPropPicksHeader activeApp="prizepicks" onAppChange={onAppChange} />,
    );

    const heading = screen.getByRole("heading", { name: "WNBA Props" });
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

  it("keeps emerald banner and tab ids", () => {
    render(
      <WnbaPropPicksHeader activeApp="prizepicks" onAppChange={vi.fn()} />,
    );

    const header = screen.getByTestId("wnba-prop-picks-header");
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(5, 150, 105)" });
    expect(WNBA_PROP_PICKS_BANNER_EMERALD).toBe("#059669");
    expect(banner?.className).not.toContain("overflow-hidden");
    expect(header.querySelector("img")).toBeNull();

    expect(screen.getByRole("tab", { name: "PrizePicks" })).toHaveAttribute(
      "id",
      "wnba-props-prizepicks-tab",
    );
    expect(screen.getByRole("tab", { name: "Underdog" })).toHaveAttribute(
      "aria-controls",
      "wnba-props-underdog-panel",
    );
  });

  it("renders children in the banner slot", () => {
    render(
      <WnbaPropPicksHeader activeApp="prizepicks" onAppChange={vi.fn()}>
        <span>Team filter</span>
      </WnbaPropPicksHeader>,
    );
    expect(screen.getByText("Team filter")).toBeInTheDocument();
  });
});
