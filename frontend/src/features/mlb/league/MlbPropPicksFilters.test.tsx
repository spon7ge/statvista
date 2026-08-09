import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MlbPropPicksFilters } from "./MlbPropPicksFilters";

describe("MlbPropPicksFilters", () => {
  it("renders stat/team/side filters and Clear only (no Tier or Fresh toggle)", async () => {
    const user = userEvent.setup();
    const onStatsChange = vi.fn();
    const onTeamsChange = vi.fn();
    const onSidesChange = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <MlbPropPicksFilters
        stats={["Hits", "Total Bases"]}
        teams={["LAD", "NYY"]}
        selectedStats={new Set()}
        selectedTeams={new Set()}
        selectedSides={new Set()}
        onStatsChange={onStatsChange}
        onTeamsChange={onTeamsChange}
        onSidesChange={onSidesChange}
        onClear={onClear}
      />,
    );

    expect(screen.getByRole("button", { name: "Stat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Side" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tier" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Fresh sharp vs stale DFS/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear filters" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stat" }));
    await user.click(screen.getByRole("option", { name: "Hits" }));
    expect(onStatsChange).toHaveBeenCalledWith(new Set(["Hits"]));

    await user.click(screen.getByRole("button", { name: "Team" }));
    await user.click(screen.getByRole("option", { name: "NYY" }));
    expect(onTeamsChange).toHaveBeenCalledWith(new Set(["NYY"]));

    await user.click(screen.getByRole("button", { name: "Side" }));
    await user.click(screen.getByRole("option", { name: "Under" }));
    expect(onSidesChange).toHaveBeenCalledWith(new Set(["under"]));

    rerender(
      <MlbPropPicksFilters
        stats={["Hits", "Total Bases"]}
        teams={["LAD", "NYY"]}
        selectedStats={new Set(["Hits"])}
        selectedTeams={new Set()}
        selectedSides={new Set()}
        onStatsChange={onStatsChange}
        onTeamsChange={onTeamsChange}
        onSidesChange={onSidesChange}
        onClear={onClear}
      />,
    );

    expect(screen.getByRole("button", { name: "Stat (1)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("hides Team filter when no team options are available", () => {
    render(
      <MlbPropPicksFilters
        stats={["Hits"]}
        teams={[]}
        selectedStats={new Set()}
        selectedTeams={new Set()}
        selectedSides={new Set()}
        onStatsChange={vi.fn()}
        onTeamsChange={vi.fn()}
        onSidesChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Stat" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
  });
});
