import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MLB_FUTURES_BANNER_GREEN,
  MlbFuturesHeader,
} from "./MlbFuturesHeader";

describe("MlbFuturesHeader", () => {
  it("renders a green banner titled MLB {season} Futures with bats mark", () => {
    render(<MlbFuturesHeader season={2026} />);
    const header = screen.getByTestId("mlb-futures-header");
    expect(
      screen.getByRole("heading", { name: "MLB 2026 Futures" }),
    ).toBeInTheDocument();
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(11, 61, 46)" });
    expect(MLB_FUTURES_BANNER_GREEN).toBe("#0B3D2E");
    const mark = header.querySelector("img");
    expect(mark?.getAttribute("src") ?? "").toMatch(/mlb-crossed-bats/);
  });
});
