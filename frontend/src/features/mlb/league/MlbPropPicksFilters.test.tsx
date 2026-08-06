import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MlbPropPicksFilters } from "./MlbPropPicksFilters";

describe("MlbPropPicksFilters", () => {
  it("renders stat/team/side/tier filters and a fresh-vs-stale toggle", async () => {
    const user = userEvent.setup();
    const onStatsChange = vi.fn();
    const onTeamsChange = vi.fn();
    const onSidesChange = vi.fn();
    const onTiersChange = vi.fn();
    const onFreshVsStaleToggle = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <MlbPropPicksFilters
        stats={["Hits", "Total Bases"]}
        teams={["LAD", "NYY"]}
        selectedStats={new Set()}
        selectedTeams={new Set()}
        selectedSides={new Set()}
        selectedTiers={new Set()}
        freshVsStaleOnly={false}
        onStatsChange={onStatsChange}
        onTeamsChange={onTeamsChange}
        onSidesChange={onSidesChange}
        onTiersChange={onTiersChange}
        onFreshVsStaleToggle={onFreshVsStaleToggle}
        onClear={onClear}
      />,
    );

    expect(screen.getByRole("button", { name: "Stat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Side" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tier" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", {
      name: /Fresh sharp vs stale DFS/i,
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
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

    await user.click(screen.getByRole("button", { name: "Tier" }));
    await user.click(
      screen.getByRole("option", { name: "Sharp Consensus" }),
    );
    expect(onTiersChange).toHaveBeenCalledWith(new Set(["sharp_consensus"]));

    await user.click(toggle);
    expect(onFreshVsStaleToggle).toHaveBeenCalled();

    rerender(
      <MlbPropPicksFilters
        stats={["Hits", "Total Bases"]}
        teams={["LAD", "NYY"]}
        selectedStats={new Set(["Hits"])}
        selectedTeams={new Set()}
        selectedSides={new Set()}
        selectedTiers={new Set()}
        freshVsStaleOnly={true}
        onStatsChange={onStatsChange}
        onTeamsChange={onTeamsChange}
        onSidesChange={onSidesChange}
        onTiersChange={onTiersChange}
        onFreshVsStaleToggle={onFreshVsStaleToggle}
        onClear={onClear}
      />,
    );

    expect(screen.getByRole("button", { name: "Stat (1)" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Fresh sharp vs stale DFS/i }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });
});
