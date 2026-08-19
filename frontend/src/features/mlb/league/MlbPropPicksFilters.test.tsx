import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MlbPropPicksFilters } from "./MlbPropPicksFilters";

describe("MlbPropPicksFilters", () => {
  it("renders Team filter and player search only (no Stat or Side)", async () => {
    const user = userEvent.setup();
    const onTeamsChange = vi.fn();
    const onQueryChange = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <MlbPropPicksFilters
        teams={["LAD", "NYY"]}
        selectedTeams={new Set()}
        query=""
        onTeamsChange={onTeamsChange}
        onQueryChange={onQueryChange}
        onClear={onClear}
      />,
    );

    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search player" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search player")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Side" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tier" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear filters" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Team" }));
    await user.click(screen.getByRole("option", { name: "NYY" }));
    expect(onTeamsChange).toHaveBeenCalledWith(new Set(["NYY"]));

    await user.type(screen.getByRole("searchbox", { name: "Search player" }), "Judge");
    expect(onQueryChange).toHaveBeenCalled();

    rerender(
      <MlbPropPicksFilters
        teams={["LAD", "NYY"]}
        selectedTeams={new Set(["NYY"])}
        query=""
        onTeamsChange={onTeamsChange}
        onQueryChange={onQueryChange}
        onClear={onClear}
      />,
    );

    expect(screen.getByRole("button", { name: "Team (1)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("shows Clear filters when a player search query is active", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <MlbPropPicksFilters
        teams={["NYY"]}
        selectedTeams={new Set()}
        query="soto"
        onTeamsChange={vi.fn()}
        onQueryChange={vi.fn()}
        onClear={onClear}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("hides Team filter when no team options are available", () => {
    render(
      <MlbPropPicksFilters
        teams={[]}
        selectedTeams={new Set()}
        query=""
        onTeamsChange={vi.fn()}
        onQueryChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "Search player" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
  });
});
