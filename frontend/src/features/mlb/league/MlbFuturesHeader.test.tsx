import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbFuturesHeader } from "./MlbFuturesHeader";

describe("MlbFuturesHeader", () => {
  it("renders the MLB {season} Futures title without a green banner", () => {
    render(<MlbFuturesHeader season={2026} />);
    const header = screen.getByTestId("mlb-futures-header");
    expect(
      screen.getByRole("heading", { name: "MLB 2026 Futures" }),
    ).toBeInTheDocument();
    expect(header.querySelector("div.rounded-3xl")).toBeNull();
    expect(header.querySelector("img")).toBeNull();
  });
});
