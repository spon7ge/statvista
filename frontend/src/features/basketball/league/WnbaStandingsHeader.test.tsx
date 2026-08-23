import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WnbaStandingsHeader } from "./WnbaStandingsHeader";

describe("WnbaStandingsHeader", () => {
  it("renders the WNBA {season} Standings title without a navy banner", () => {
    render(<WnbaStandingsHeader season={2026} />);

    const header = screen.getByTestId("wnba-standings-header");
    expect(
      screen.getByRole("heading", { name: "WNBA 2026 Standings" }),
    ).toBeInTheDocument();
    expect(header.querySelector("div.rounded-3xl")).toBeNull();
    expect(header.querySelector("img")).toBeNull();
  });
});
