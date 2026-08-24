import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MlbPropPicksFilters } from "./MlbPropPicksFilters";

describe("MlbPropPicksFilters", () => {
  it("renders Team, Bookmaker, Proposition, Over/Under, and Hit rate next to player search", async () => {
    const user = userEvent.setup();
    const onTeamsChange = vi.fn();
    const onQueryChange = vi.fn();
    const onMarketsChange = vi.fn();
    const onSidesChange = vi.fn();
    const onHitRateChange = vi.fn();
    const onBooksChange = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <MlbPropPicksFilters
        teams={["LAD", "NYY"]}
        selectedTeams={new Set()}
        query=""
        onTeamsChange={onTeamsChange}
        onQueryChange={onQueryChange}
        onClear={onClear}
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
          { value: "draftkings", label: "DraftKings" },
          { value: "fanduel", label: "FanDuel" },
        ]}
        selectedBooks={new Set()}
        onBooksChange={onBooksChange}
      />,
    );

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
    await user.click(screen.getByRole("option", { name: "Hits" }));
    expect(onMarketsChange).toHaveBeenCalledWith(new Set(["hits"]));

    await user.click(screen.getByRole("button", { name: "Over/Under" }));
    await user.click(screen.getByRole("option", { name: "Over" }));
    expect(onSidesChange).toHaveBeenCalledWith(new Set(["over"]));

    await user.click(screen.getByRole("button", { name: "Hit rate" }));
    await user.click(screen.getByRole("option", { name: "L10" }));
    expect(onHitRateChange).toHaveBeenCalledWith("l10");

    await user.click(screen.getByRole("button", { name: "Bookmaker" }));
    await user.click(screen.getByRole("option", { name: "DraftKings" }));
    expect(onBooksChange).toHaveBeenCalledWith(new Set(["draftkings"]));

    rerender(
      <MlbPropPicksFilters
        teams={["LAD", "NYY"]}
        selectedTeams={new Set(["NYY"])}
        query=""
        onTeamsChange={onTeamsChange}
        onQueryChange={onQueryChange}
        onClear={onClear}
        markets={[{ value: "hits", label: "Hits" }]}
        selectedMarkets={new Set(["hits"])}
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
    expect(screen.queryByRole("button", { name: "Bookmaker" })).not.toBeInTheDocument();
  });
});
