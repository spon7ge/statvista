import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MLB_STANDINGS_BANNER_NAVY,
  MlbStandingsHeader,
} from "./MlbStandingsHeader";

describe("MlbStandingsHeader", () => {
  it("renders a navy banner titled MLB {season} Standings with bats mark", () => {
    render(<MlbStandingsHeader season={2026} />);
    const header = screen.getByTestId("mlb-standings-header");
    expect(
      screen.getByRole("heading", { name: "MLB 2026 Standings" }),
    ).toBeInTheDocument();
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(10, 35, 81)" });
    expect(MLB_STANDINGS_BANNER_NAVY).toBe("#0A2351");
    const mark = header.querySelector("img");
    expect(mark?.getAttribute("src") ?? "").toMatch(/mlb-crossed-bats/);
  });
});
