import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WnbaPropPicksFilters } from "./WnbaPropPicksFilters";

describe("WnbaPropPicksFilters", () => {
  it("renders Team filter and player search only (no Stat or Side)", async () => {
    const user = userEvent.setup();
    const onTeamsChange = vi.fn();
    const onQueryChange = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <WnbaPropPicksFilters
        teams={["ATL", "SEA"]}
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
    await user.click(screen.getByRole("option", { name: "ATL" }));
    expect(onTeamsChange).toHaveBeenCalledWith(new Set(["ATL"]));

    await user.type(screen.getByRole("searchbox", { name: "Search player" }), "Howard");
    expect(onQueryChange).toHaveBeenCalled();

    rerender(
      <WnbaPropPicksFilters
        teams={["ATL", "SEA"]}
        selectedTeams={new Set(["ATL"])}
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
      <WnbaPropPicksFilters
        teams={["ATL"]}
        selectedTeams={new Set()}
        query="howard"
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
      <WnbaPropPicksFilters
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
