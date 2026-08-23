import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WnbaFuturesHeader } from "./WnbaFuturesHeader";

describe("WnbaFuturesHeader", () => {
  it("renders the WNBA {season} Futures title without a green banner", () => {
    render(<WnbaFuturesHeader season={2026} />);

    const header = screen.getByTestId("wnba-futures-header");
    expect(
      screen.getByRole("heading", { name: "WNBA 2026 Futures" }),
    ).toBeInTheDocument();
    expect(header.querySelector("div.rounded-3xl")).toBeNull();
    expect(header.querySelector("img")).toBeNull();
  });
});
