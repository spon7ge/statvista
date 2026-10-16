import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MlbPropPicksFilters } from "./MlbPropPicksFilters";

describe("MlbPropPicksFilters", () => {
  it("renders Game, Bookmaker, Proposition, Over/Under, and Hit rate next to player search", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const onMarketsChange = vi.fn();
    const onSidesChange = vi.fn();
    const onHitRateChange = vi.fn();
    const onBooksChange = vi.fn();
    const onGamesChange = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <MlbPropPicksFilters
        query=""
        onQueryChange={onQueryChange}
        onClear={onClear}
        games={[
          { value: "1", label: "NYY @ BOS" },
          { value: "2", label: "LAD @ SF" },
        ]}
        selectedGames={new Set()}
        onGamesChange={onGamesChange}
        markets={[
          { value: "hits", label: "Hits" },
          { value: "strikeouts", label: "Strikeouts" },
        ]}
        selectedMarkets={new Set()}
        onMarketsChange={onMarketsChange}
        selectedSides={new Set()}
        onSidesChange={onSidesChange}
        hitRate={null}
        onHitRateChange={onHitRateChange}
        books={[
          { value: "prizepicks", label: "PrizePicks" },
          { value: "draftkings", label: "DraftKings" },
          { value: "fanduel", label: "FanDuel" },
        ]}
        selectedBooks={new Set(["prizepicks"])}
        onBooksChange={onBooksChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Game" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    ).toBeInTheDocument();
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
    await user.click(screen.getByRole("option", { name: "Hits" }));
    expect(onMarketsChange).toHaveBeenCalledWith(new Set(["hits"]));

    await user.click(screen.getByRole("button", { name: "Over/Under" }));
    await user.click(screen.getByRole("option", { name: "Over" }));
    expect(onSidesChange).toHaveBeenCalledWith(new Set(["over"]));

    await user.click(screen.getByRole("button", { name: "Hit rate" }));
    await user.click(screen.getByRole("option", { name: "L10" }));
    expect(onHitRateChange).toHaveBeenCalledWith("l10");

    await user.click(screen.getByRole("button", { name: "Bookmaker (PrizePicks)" }));
    await user.click(screen.getByRole("option", { name: "PrizePicks" }));
    expect(onBooksChange).toHaveBeenCalledWith(new Set());

    await user.click(screen.getByRole("button", { name: "Bookmaker (PrizePicks)" }));
    await user.click(screen.getByRole("option", { name: "DraftKings" }));
    expect(onBooksChange).toHaveBeenCalledWith(new Set(["draftkings"]));

    await user.click(screen.getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("option", { name: "NYY @ BOS" }));
    expect(onGamesChange).toHaveBeenCalledWith(new Set(["1"]));

    rerender(
      <MlbPropPicksFilters
        query=""
        onQueryChange={onQueryChange}
        onClear={onClear}
        games={[
          { value: "1", label: "NYY @ BOS" },
          { value: "2", label: "LAD @ SF" },
        ]}
        selectedGames={new Set(["1"])}
        onGamesChange={onGamesChange}
        markets={[{ value: "hits", label: "Hits" }]}
        selectedMarkets={new Set(["hits"])}
        onMarketsChange={onMarketsChange}
        selectedSides={new Set(["over"])}
        onSidesChange={onSidesChange}
        hitRate="l10"
        onHitRateChange={onHitRateChange}
        books={[
          { value: "prizepicks", label: "PrizePicks" },
          { value: "draftkings", label: "DraftKings" },
          { value: "fanduel", label: "FanDuel" },
        ]}
        selectedBooks={new Set(["draftkings"])}
        onBooksChange={onBooksChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Game (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bookmaker (DraftKings)" }),
    ).toBeInTheDocument();
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
      <MlbPropPicksFilters
        query="soto"
        onQueryChange={vi.fn()}
        onClear={onClear}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("does not render a Team filter", () => {
    render(
      <MlbPropPicksFilters
        query=""
        onQueryChange={vi.fn()}
        onClear={vi.fn()}
        books={[{ value: "prizepicks", label: "PrizePicks" }]}
        selectedBooks={new Set(["prizepicks"])}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "Search player" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Game" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    ).toBeInTheDocument();
  });
});
