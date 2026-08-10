import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  WNBA_LEADERS_BANNER_ORANGE,
  WnbaLeadersHeader,
} from "./WnbaLeadersHeader";

describe("WnbaLeadersHeader", () => {
  it("renders an orange banner titled WNBA {season} Leaders with basketball mark", () => {
    render(<WnbaLeadersHeader season={2026} />);

    const header = screen.getByTestId("wnba-leaders-header");
    expect(
      screen.getByRole("heading", { name: "WNBA 2026 Leaders" }),
    ).toBeInTheDocument();
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(243, 131, 18)" });
    expect(WNBA_LEADERS_BANNER_ORANGE).toBe("#F38312");
    const mark = header.querySelector("img");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("src") ?? "").toMatch(/wnba_basketball/);
  });
});
