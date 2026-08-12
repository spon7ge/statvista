import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WnbaPropPicksFilters } from "./WnbaPropPicksFilters";

describe("WnbaPropPicksFilters", () => {
  it("renders stat/team/side filters and Clear only (no Tier or Fresh toggle)", async () => {
    const user = userEvent.setup();
    const onStatsChange = vi.fn();
    const onTeamsChange = vi.fn();
    const onSidesChange = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <WnbaPropPicksFilters
        stats={["Points", "Assists"]}
        teams={["ATL", "SEA"]}
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
    await user.click(screen.getByRole("option", { name: "Points" }));
    expect(onStatsChange).toHaveBeenCalledWith(new Set(["Points"]));

    await user.click(screen.getByRole("button", { name: "Team" }));
    await user.click(screen.getByRole("option", { name: "ATL" }));
    expect(onTeamsChange).toHaveBeenCalledWith(new Set(["ATL"]));

    await user.click(screen.getByRole("button", { name: "Side" }));
    await user.click(screen.getByRole("option", { name: "Under" }));
    expect(onSidesChange).toHaveBeenCalledWith(new Set(["under"]));

    rerender(
      <WnbaPropPicksFilters
        stats={["Points", "Assists"]}
        teams={["ATL", "SEA"]}
        selectedStats={new Set(["Points"])}
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
      <WnbaPropPicksFilters
        stats={["Points"]}
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
