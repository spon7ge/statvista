import type { ReactElement } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MlbPropPlayerCard } from "./groupMlbPropPlayers";
import { slugifyPlayerName } from "./groupMlbPropPlayers";
import {
  formatMlbPropPicksUpdatedAt,
  MLB_PROP_PICKS_PAGE_SIZE,
  MlbPropPicksList,
  splitPropsIntoColumns,
} from "./MlbPropPicksList";

function player(
  partial: Partial<MlbPropPlayerCard> & Pick<MlbPropPlayerCard, "player_name">,
): MlbPropPlayerCard {
  const player_name = partial.player_name;
  return {
    player_slug: slugifyPlayerName(player_name),
    prop_count: 2,
    team_abbrev: "NYY",
    position: "RF",
    headshot_url: null,
    stats: ["Hits", "Total Bases"],
    rows: [],
    ...partial,
  };
}

function renderList(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const judge = player({
  player_name: "Aaron Judge",
  prop_count: 2,
  team_abbrev: "NYY",
  position: "RF",
  headshot_url:
    "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png",
});

describe("MlbPropPicksList", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-08-05T20:00:00Z"));
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a player card with View N props link and no Over/Under or edge", () => {
    renderList(
      <MlbPropPicksList players={[judge]} app="prizepicks" />,
    );

    const card = screen.getByTestId("mlb-prop-row");
    expect(within(card).getByRole("img", { name: /Aaron Judge/i })).toHaveAttribute(
      "src",
      expect.stringContaining("33192.png"),
    );
    expect(within(card).getByText("NYY · RF")).toBeInTheDocument();
    expect(within(card).getByText("Aaron Judge")).toBeInTheDocument();
    expect(within(card).getByTestId("statvista-bars-mark")).toBeInTheDocument();

    const cta = within(card).getByRole("link", { name: "View 2 props" });
    expect(cta).toHaveAttribute(
      "href",
      "/mlb/prop_picks/player/aaron-judge?app=prizepicks",
    );

    expect(within(card).queryByText("Over")).not.toBeInTheDocument();
    expect(within(card).queryByText("Under")).not.toBeInTheDocument();
    expect(within(card).queryByText(/\+5\.1%/)).not.toBeInTheDocument();
    expect(within(card).queryByText("1.5 Total Bases")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-prop-row-expand")).not.toBeInTheDocument();
    expect(screen.queryByText(/Breakeven/i)).not.toBeInTheDocument();
  });

  it("preserves app query on the View props link for Underdog", () => {
    renderList(
      <MlbPropPicksList
        players={[player({ player_name: "Mookie Betts", prop_count: 1 })]}
        app="underdog"
      />,
    );
    expect(screen.getByRole("link", { name: "View 1 props" })).toHaveAttribute(
      "href",
      "/mlb/prop_picks/player/mookie-betts?app=underdog",
    );
  });

  it("uses initials placeholder when headshot missing", () => {
    renderList(
      <MlbPropPicksList
        players={[player({ player_name: "Aaron Judge", headshot_url: null })]}
        app="prizepicks"
      />,
    );
    expect(screen.queryByRole("img", { name: /Aaron Judge/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("mlb-prop-headshot-fallback")).toHaveTextContent("A");
  });

  it("shows loading skeletons", () => {
    renderList(
      <MlbPropPicksList players={[]} app="prizepicks" isLoading />,
    );
    expect(screen.getByLabelText("Loading MLB prop picks")).toBeInTheDocument();
  });

  it("shows API error copy", () => {
    renderList(
      <MlbPropPicksList players={[]} app="prizepicks" isError />,
    );
    expect(screen.getByText("Prop lines unavailable")).toBeInTheDocument();
  });

  it("shows filter-empty copy when filters hide all players", () => {
    renderList(
      <MlbPropPicksList players={[]} app="prizepicks" filtersActive />,
    );
    expect(screen.getByText("No props match these filters")).toBeInTheDocument();
  });

  it("shows a custom empty message when provided", () => {
    renderList(
      <MlbPropPicksList
        players={[]}
        app="prizepicks"
        emptyMessage="No PrizePicks board available."
      />,
    );
    expect(
      screen.getByText("No PrizePicks board available."),
    ).toBeInTheDocument();
  });

  it("shows last updated when provided", () => {
    const boardMs = Date.parse("2026-08-05T20:00:00Z");
    renderList(
      <MlbPropPicksList
        players={[judge]}
        app="prizepicks"
        lastUpdatedAt={boardMs}
      />,
    );
    expect(
      screen.getByText(`Last updated ${formatMlbPropPicksUpdatedAt(boardMs)}`),
    ).toBeInTheDocument();
  });

  it("lays out players in independent columns", () => {
    renderList(
      <MlbPropPicksList
        players={[
          judge,
          player({ player_name: "Mookie Betts", team_abbrev: "LAD", position: "SS" }),
        ]}
        app="prizepicks"
      />,
    );
    const grid = screen.getByTestId("mlb-prop-picks-grid");
    expect(grid.className).toMatch(/\bflex\b/);
    expect(grid.className).not.toMatch(/columns-/);
    expect(screen.getAllByTestId("mlb-prop-picks-column").length).toBeGreaterThanOrEqual(1);
  });

  it("paginates to 20 players with next/previous", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: MLB_PROP_PICKS_PAGE_SIZE + 3 }, (_, i) =>
      player({
        player_name: `Player ${i}`,
        prop_count: 1,
      }),
    );

    renderList(
      <MlbPropPicksList players={many} app="prizepicks" />,
    );

    expect(screen.getByText("Showing 1–20 of 23")).toBeInTheDocument();
    expect(screen.getByText("Player 0")).toBeInTheDocument();
    expect(screen.queryByText("Player 20")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing 21–23 of 23")).toBeInTheDocument();
    expect(screen.getByText("Player 20")).toBeInTheDocument();
    expect(screen.queryByText("Player 0")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("splitPropsIntoColumns", () => {
  it("round-robins so visual rows keep rank order", () => {
    expect(splitPropsIntoColumns([1, 2, 3, 4, 5, 6], 3)).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it("uses a single column when count is 1", () => {
    expect(splitPropsIntoColumns(["a", "b"], 1)).toEqual([["a", "b"]]);
  });
});
