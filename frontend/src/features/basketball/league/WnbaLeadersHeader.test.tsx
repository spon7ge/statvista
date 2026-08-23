import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WnbaLeadersHeader } from "./WnbaLeadersHeader";

describe("WnbaLeadersHeader", () => {
  it("renders the WNBA {season} Leaders title without an orange banner", () => {
    render(<WnbaLeadersHeader season={2026} />);

    const header = screen.getByTestId("wnba-leaders-header");
    expect(
      screen.getByRole("heading", { name: "WNBA 2026 Leaders" }),
    ).toBeInTheDocument();
    expect(header.querySelector("div.rounded-3xl")).toBeNull();
    expect(header.querySelector("img")).toBeNull();
  });
});
