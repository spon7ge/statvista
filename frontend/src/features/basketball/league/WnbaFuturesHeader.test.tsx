import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  WNBA_FUTURES_BANNER_GREEN,
  WnbaFuturesHeader,
} from "./WnbaFuturesHeader";

describe("WnbaFuturesHeader", () => {
  it("renders a green banner titled WNBA {season} Futures with basketball mark", () => {
    render(<WnbaFuturesHeader season={2026} />);

    const header = screen.getByTestId("wnba-futures-header");
    expect(
      screen.getByRole("heading", { name: "WNBA 2026 Futures" }),
    ).toBeInTheDocument();
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(11, 61, 46)" });
    expect(WNBA_FUTURES_BANNER_GREEN).toBe("#0B3D2E");
    const mark = header.querySelector("img");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("src") ?? "").toMatch(/wnba_basketball/);
  });
});
