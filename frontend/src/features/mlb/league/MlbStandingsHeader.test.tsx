import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbStandingsHeader } from "./MlbStandingsHeader";

describe("MlbStandingsHeader", () => {
  it("renders the MLB {season} Standings title without a navy banner", () => {
    render(
      <MlbStandingsHeader
        season={2026}
        view="division"
        onViewChange={() => {}}
      />,
    );
    const header = screen.getByTestId("mlb-standings-header");
    expect(
      screen.getByRole("heading", { name: "MLB 2026 Standings" }),
    ).toBeInTheDocument();
    expect(header.querySelector("div.rounded-3xl")).toBeNull();
    expect(header.querySelector("img")).toBeNull();
  });

  it("exposes Division and Conference tabs with Division selected by default", () => {
    render(
      <MlbStandingsHeader
        season={2026}
        view="division"
        onViewChange={() => {}}
      />,
    );
    const division = screen.getByRole("tab", { name: "Division" });
    const conference = screen.getByRole("tab", { name: "Conference" });
    expect(division).toHaveAttribute("aria-selected", "true");
    expect(conference).toHaveAttribute("aria-selected", "false");
  });

  it("calls onViewChange when Conference is clicked", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render(
      <MlbStandingsHeader
        season={2026}
        view="division"
        onViewChange={onViewChange}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Conference" }));
    expect(onViewChange).toHaveBeenCalledWith("conference");
  });
});
