import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  WNBA_STANDINGS_BANNER_NAVY,
  WnbaStandingsHeader,
} from "./WnbaStandingsHeader";

describe("WnbaStandingsHeader", () => {
  it("renders a navy banner titled WNBA {season} Standings with basketball mark", () => {
    render(<WnbaStandingsHeader season={2026} />);

    const header = screen.getByTestId("wnba-standings-header");
    expect(
      screen.getByRole("heading", { name: "WNBA 2026 Standings" }),
    ).toBeInTheDocument();
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(10, 35, 81)" });
    expect(WNBA_STANDINGS_BANNER_NAVY).toBe("#0A2351");
    const mark = header.querySelector("img");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("src") ?? "").toMatch(/wnba_basketball/);
  });
});
