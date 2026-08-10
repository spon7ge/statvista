import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  WNBA_PROP_PICKS_BANNER_EMERALD,
  WnbaPropPicksHeader,
} from "./WnbaPropPicksHeader";

describe("WnbaPropPicksHeader", () => {
  it("renders an emerald banner titled WNBA Props with basketball mark and no MLB-style controls", () => {
    render(<WnbaPropPicksHeader />);

    const header = screen.getByTestId("wnba-prop-picks-header");
    expect(
      screen.getByRole("heading", { name: "WNBA Props" }),
    ).toBeInTheDocument();
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(5, 150, 105)" });
    expect(WNBA_PROP_PICKS_BANNER_EMERALD).toBe("#059669");
    const mark = header.querySelector("img");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("src") ?? "").toMatch(/wnba_basketball/);
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("group", { name: "Legs" })).toBeNull();
  });
});
