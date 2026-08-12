import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  WNBA_PROP_PICKS_BANNER_EMERALD,
  WnbaPropPicksHeader,
} from "./WnbaPropPicksHeader";

describe("WnbaPropPicksHeader", () => {
  it("renders PrizePicks and Underdog tabs and a legs pill", () => {
    render(
      <WnbaPropPicksHeader
        activeApp="prizepicks"
        onAppChange={() => {}}
        legs={4}
        onLegsChange={() => {}}
      />,
    );
    expect(screen.getByRole("tab", { name: "PrizePicks" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("group", { name: "Legs" })).toHaveTextContent(
      "4-pick",
    );
    expect(
      screen.getByRole("heading", { name: "WNBA Props" }),
    ).toBeInTheDocument();
  });

  it("keeps emerald banner, basketball mark, and wires app/legs callbacks", async () => {
    const user = userEvent.setup();
    const onAppChange = vi.fn();
    const onLegsChange = vi.fn();
    render(
      <WnbaPropPicksHeader
        activeApp="prizepicks"
        onAppChange={onAppChange}
        legs={4}
        onLegsChange={onLegsChange}
      />,
    );

    const header = screen.getByTestId("wnba-prop-picks-header");
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(5, 150, 105)" });
    expect(WNBA_PROP_PICKS_BANNER_EMERALD).toBe("#059669");
    const mark = header.querySelector("img");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("src") ?? "").toMatch(/wnba_basketball/);

    expect(screen.getByRole("tab", { name: "PrizePicks" })).toHaveAttribute(
      "id",
      "wnba-props-prizepicks-tab",
    );
    expect(screen.getByRole("tab", { name: "Underdog" })).toHaveAttribute(
      "aria-controls",
      "wnba-props-underdog-panel",
    );

    await user.click(screen.getByRole("tab", { name: "Underdog" }));
    expect(onAppChange).toHaveBeenCalledWith("underdog");
    await user.click(screen.getByRole("button", { name: "More legs" }));
    expect(onLegsChange).toHaveBeenCalledWith(5);
  });
});
