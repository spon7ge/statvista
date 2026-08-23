import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbLeadersHeader } from "./MlbLeadersHeader";

describe("MlbLeadersHeader", () => {
  it("renders the MLB {season} Leaders title without an orange banner", () => {
    render(<MlbLeadersHeader season={2026} />);

    const header = screen.getByTestId("mlb-leaders-header");
    expect(
      screen.getByRole("heading", { name: "MLB 2026 Leaders" }),
    ).toBeInTheDocument();
    expect(header.querySelector("div.rounded-3xl")).toBeNull();
    expect(header.querySelector("img")).toBeNull();
  });
});
