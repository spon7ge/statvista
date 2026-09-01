import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WnbaPropPicksFilters } from "./WnbaPropPicksFilters";

describe("WnbaPropPicksFilters", () => {
  it("renders Game, Team, Bookmaker, Proposition, Over/Under, and Hit rate next to player search", async () => {
    const user = userEvent.setup();
    const onTeamsChange = vi.fn();
    const onQueryChange = vi.fn();
    const onMarketsChange = vi.fn();
    const onSidesChange = vi.fn();
    const onHitRateChange = vi.fn();
    const onBooksChange = vi.fn();
    const onGamesChange = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <WnbaPropPicksFilters
        teams={["ATL", "IND"]}
        selectedTeams={new Set()}
        query=""
        onTeamsChange={onTeamsChange}
        onQueryChange={onQueryChange}
        onClear={onClear}
        games={[
          { value: "1", label: "IND @ NYL" },
          { value: "2", label: "ATL @ CHI" },
        ]}
        selectedGames={new Set()}
        onGamesChange={onGamesChange}
        markets={[
          { value: "points", label: "Points" },
          { value: "assists", label: "Assists" },
        ]}
        selectedMarkets={new Set()}
        onMarketsChange={onMarketsChange}
        selectedSides={new Set()}
        onSidesChange={onSidesChange}
        hitRate={null}
        onHitRateChange={onHitRateChange}
        books={[
          { value: "draftkings", label: "DraftKings" },
          { value: "fanduel", label: "FanDuel" },
        ]}
        selectedBooks={new Set()}
        onBooksChange={onBooksChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bookmaker" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proposition" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Over/Under" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hit rate" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search player" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Side" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear filters" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Proposition" }));
    await user.click(screen.getByRole("option", { name: "Points" }));
    expect(onMarketsChange).toHaveBeenCalledWith(new Set(["points"]));

    await user.click(screen.getByRole("button", { name: "Over/Under" }));
    await user.click(screen.getByRole("option", { name: "Over" }));
    expect(onSidesChange).toHaveBeenCalledWith(new Set(["over"]));

    await user.click(screen.getByRole("button", { name: "Hit rate" }));
    await user.click(screen.getByRole("option", { name: "L10" }));
    expect(onHitRateChange).toHaveBeenCalledWith("l10");

    await user.click(screen.getByRole("button", { name: "Bookmaker" }));
    await user.click(screen.getByRole("option", { name: "DraftKings" }));
    expect(onBooksChange).toHaveBeenCalledWith(new Set(["draftkings"]));

    await user.click(screen.getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("option", { name: "IND @ NYL" }));
    expect(onGamesChange).toHaveBeenCalledWith(new Set(["1"]));

    rerender(
      <WnbaPropPicksFilters
        teams={["ATL", "IND"]}
        selectedTeams={new Set(["IND"])}
        query=""
        onTeamsChange={onTeamsChange}
        onQueryChange={onQueryChange}
        onClear={onClear}
        games={[
          { value: "1", label: "IND @ NYL" },
          { value: "2", label: "ATL @ CHI" },
        ]}
        selectedGames={new Set(["1"])}
        onGamesChange={onGamesChange}
        markets={[{ value: "points", label: "Points" }]}
        selectedMarkets={new Set(["points"])}
        onMarketsChange={onMarketsChange}
        selectedSides={new Set(["over"])}
        onSidesChange={onSidesChange}
        hitRate="l10"
        onHitRateChange={onHitRateChange}
        books={[
          { value: "draftkings", label: "DraftKings" },
          { value: "fanduel", label: "FanDuel" },
        ]}
        selectedBooks={new Set(["draftkings"])}
        onBooksChange={onBooksChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Game (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bookmaker (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proposition (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Over/Under (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hit rate (L10)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("shows Clear filters when a player search query is active", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <WnbaPropPicksFilters
        teams={["IND"]}
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
    expect(screen.queryByRole("button", { name: "Game" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bookmaker" })).not.toBeInTheDocument();
  });
});
