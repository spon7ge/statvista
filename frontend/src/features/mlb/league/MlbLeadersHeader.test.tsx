import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MLB_LEADERS_BANNER_ORANGE,
  MlbLeadersHeader,
} from "./MlbLeadersHeader";

describe("MlbLeadersHeader", () => {
  it("renders an orange banner titled MLB {season} Leaders with bats mark", () => {
    render(<MlbLeadersHeader season={2026} />);

    const header = screen.getByTestId("mlb-leaders-header");
    expect(
      screen.getByRole("heading", { name: "MLB 2026 Leaders" }),
    ).toBeInTheDocument();
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({
      backgroundColor: "rgb(243, 131, 18)",
    });
    expect(MLB_LEADERS_BANNER_ORANGE).toBe("#F38312");
    const mark = header.querySelector("img");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("src") ?? "").toMatch(/mlb-crossed-bats/);
  });
});

