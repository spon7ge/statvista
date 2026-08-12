import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiWnbaPropRow } from "@/shared/lib/api";
import {
  dfsOddsPayoutLabel,
  formatWnbaPropPicksUpdatedAt,
  WNBA_PROP_PICKS_PAGE_SIZE,
  WnbaPropPicksList,
  resolveBookLastUpdatedMs,
  splitPropsIntoColumns,
} from "./WnbaPropPicksList";

function row(
  partial: Partial<ApiWnbaPropRow> & Pick<ApiWnbaPropRow, "player_name">,
): ApiWnbaPropRow {
  return {
    team_abbrev: null,
    position: null,
    headshot_url: null,
    commence_time: null,
    stat: "Points",
    line: 18.5,
    recommended_side: "over",
    fair_pct: 58.2,
    edge_pct: 5.1,
    alt_edge_pct: -2.4,
    source_tier: "sharp_consensus",
    confidence_chips: [],
    sample_chips: [],
    recency_chip: null,
    books: {
      prophetx: {
        side: "over",
        fair_pct: 58.5,
        american: -140,
        changed_at: "2026-08-05T19:50:00Z",
        role: null,
      },
      novig: {
        side: "over",
        fair_pct: 57.8,
        american: -137,
        changed_at: "2026-08-05T19:48:00Z",
        role: null,
      },
      draftkings: null,
      fanduel: null,
      pinnacle: {
        side: "over",
        fair_pct: 55.0,
        american: -122,
        changed_at: "2026-08-05T19:30:00Z",
        role: "comparison",
      },
    },
    dfs: {
      line: 18.5,
      changed_at: "2026-08-05T19:00:00Z",
      american: null,
      payout_multiplier: null,
    },
    fair_explain: "PX+Novig agree within 2pp; 60/40 blend.",
    ...partial,
  };
}

const howard = row({
  player_name: "Rhyne Howard",
  team_abbrev: "ATL",
  source_tier: "sharp_consensus",
  recency_chip: "fresh_sharp_vs_stale_dfs",
});

const noRead = row({
  player_name: "Jewell Loyd",
  team_abbrev: "SEA",
  stat: "Assists",
  recommended_side: "under",
  fair_pct: null,
  edge_pct: null,
  alt_edge_pct: null,
  source_tier: "no_sharp_read",
  books: {
    prophetx: null,
    novig: null,
    draftkings: null,
    fanduel: null,
    pinnacle: null,
  },
});

describe("WnbaPropPicksList", () => {
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

  it("renders PrizePicks-style collapsed card", () => {
    const enriched = row({
      player_name: "Rhyne Howard",
      team_abbrev: "ATL",
      position: "G",
      headshot_url:
        "https://a.espncdn.com/i/headshots/wnba/players/full/123.png",
      edge_pct: 5.1,
    });
    render(
      <WnbaPropPicksList
        props={[enriched]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    const card = screen.getByTestId("wnba-prop-row");
    expect(within(card).getByRole("img", { name: /Rhyne Howard/i })).toHaveAttribute(
      "src",
      expect.stringContaining("123.png"),
    );
    expect(within(card).getByText("ATL · G")).toBeInTheDocument();
    expect(within(card).getByText("Rhyne Howard")).toBeInTheDocument();
    expect(within(card).getByText("18.5 Points")).toBeInTheDocument();
    expect(within(card).getByTestId("statvista-bars-mark")).toBeInTheDocument();
    expect(within(card).queryByTestId("wnba-prop-dfs-odds")).not.toBeInTheDocument();
    expect(within(card).getByText("Over")).toBeInTheDocument();
    expect(within(card).getByText("+5.1%").className).toMatch(/text-emerald-400/);
    expect(screen.queryByText(/PX\+Novig agree/i)).not.toBeInTheDocument();
  });

  it("shows Underdog american odds and payout under the line", () => {
    render(
      <WnbaPropPicksList
        props={[
          row({
            player_name: "Rhyne Howard",
            dfs: {
              line: 18.5,
              changed_at: "2026-08-05T19:00:00Z",
              american: -102,
              payout_multiplier: 1.05,
            },
          }),
        ]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    expect(screen.getByTestId("wnba-prop-dfs-odds")).toHaveTextContent(
      "-102 · 1.05×",
    );
  });

  it("uses initials placeholder when headshot missing", () => {
    render(
      <WnbaPropPicksList
        props={[row({ player_name: "Rhyne Howard", headshot_url: null })]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    expect(screen.queryByRole("img", { name: /Rhyne Howard/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("wnba-prop-headshot-fallback")).toHaveTextContent("R");
  });

  it("colors negative edge red on collapsed row", () => {
    render(
      <WnbaPropPicksList
        props={[
          row({
            player_name: "A'ja Wilson",
            recommended_side: "under",
            edge_pct: -3.2,
          }),
        ]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );

    const edge = screen.getByText("-3.2%");
    expect(edge.className).toMatch(/text-red-400/);
    expect(screen.getByText("Under")).toBeInTheDocument();
  });

  it("expands to show prophetx and pinnacle comparison", async () => {
    const user = userEvent.setup();
    render(
      <WnbaPropPicksList
        props={[howard]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Rhyne Howard/i }));

    expect(screen.getByText(/PX\+Novig agree within 2pp/i)).toBeInTheDocument();
    const expanded = screen.getByTestId("wnba-prop-row-expand");
    expect(within(expanded).getByText("ProphetX")).toBeInTheDocument();
    expect(within(expanded).getByText("Novig")).toBeInTheDocument();
    expect(within(expanded).getByText("Pinnacle")).toBeInTheDocument();
    expect(within(expanded).queryByText("Kalshi")).not.toBeInTheDocument();
    expect(within(expanded).queryByText("BetMGM")).not.toBeInTheDocument();
    expect(within(expanded).queryByText("BetOnline")).not.toBeInTheDocument();
    expect(screen.getByTestId("wnba-prop-row").className).toMatch(
      /ring-\[#059669\]/,
    );
  });

  it("shows mid-tier book quotes on expand when present", async () => {
    const user = userEvent.setup();
    const withCmp = row({
      player_name: "Rhyne Howard",
      books: {
        ...howard.books,
        draftkings: {
          side: "over",
          fair_pct: 56.0,
          american: -127,
          changed_at: "2026-08-05T19:40:00Z",
          role: "comparison",
        },
        fanduel: {
          side: "over",
          fair_pct: 55.0,
          american: -122,
          changed_at: "2026-08-05T19:42:00Z",
          role: "comparison",
        },
      },
    });
    render(
      <WnbaPropPicksList
        props={[withCmp]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Rhyne Howard/i }));
    const expanded = screen.getByTestId("wnba-prop-row-expand");
    expect(within(expanded).getByText("DraftKings")).toBeInTheDocument();
    expect(within(expanded).getByText("FanDuel")).toBeInTheDocument();
    expect(within(expanded).queryByText(/\(cmp\)/i)).not.toBeInTheDocument();
  });

  it("renders No Sharp Read rows muted with edge em-dash, parked last", () => {
    render(
      <WnbaPropPicksList
        props={[howard, noRead]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );

    const rows = screen.getAllByTestId("wnba-prop-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[1]!).getByText("Jewell Loyd")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("18.5 Assists")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("No Sharp Read")).not.toBeInTheDocument();
    expect(rows[1]!.className).toMatch(/opacity-60/);
  });

  it("shows loading skeletons", () => {
    render(
      <WnbaPropPicksList
        props={[]}
        format="power"
        legs={4}
        breakevenPct={null}
        isLoading
      />,
    );
    expect(screen.getByLabelText("Loading WNBA prop picks")).toBeInTheDocument();
  });

  it("shows API error copy", () => {
    render(
      <WnbaPropPicksList
        props={[]}
        format="power"
        legs={4}
        breakevenPct={null}
        isError
      />,
    );
    expect(screen.getByText("Prop lines unavailable")).toBeInTheDocument();
  });

  it("shows filter-empty copy when filters hide all rows", () => {
    render(
      <WnbaPropPicksList
        props={[]}
        format="power"
        legs={4}
        breakevenPct={null}
        filtersActive
      />,
    );
    expect(screen.getByText("No props match these filters")).toBeInTheDocument();
  });

  it("shows a custom empty message when provided", () => {
    render(
      <WnbaPropPicksList
        props={[]}
        format="power"
        legs={4}
        breakevenPct={null}
        emptyMessage="No PrizePicks board available."
      />,
    );
    expect(
      screen.getByText("No PrizePicks board available."),
    ).toBeInTheDocument();
  });

  it("shows the fair/DFS/Soft Consensus caption when rows are present", () => {
    render(
      <WnbaPropPicksList
        props={[howard]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    expect(
      screen.getByText(
        "Fair from ProphetX/Novig (then DK/FD); Soft Consensus when 2+ soft books (Pinnacle alone does not). DFS lines from PrizePicks/Underdog.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the breakeven context for the selected format/legs", () => {
    render(
      <WnbaPropPicksList
        props={[howard]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    expect(
      screen.getByText("Breakeven for 4-pick Power: 54.3%"),
    ).toBeInTheDocument();
  });

  it("sets book cell title from quote.changed_at on expand", async () => {
    const user = userEvent.setup();
    const boardMs = Date.parse("2026-08-05T20:00:00Z");
    render(
      <WnbaPropPicksList
        props={[howard]}
        format="power"
        legs={4}
        breakevenPct={54.3}
        lastUpdatedAt={boardMs}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Rhyne Howard/i }));
    const expanded = screen.getByTestId("wnba-prop-row-expand");
    const px = within(expanded).getByText("ProphetX").closest("div");
    expect(px).toHaveAttribute(
      "title",
      `Last updated ${formatWnbaPropPicksUpdatedAt(Date.parse("2026-08-05T19:50:00Z"))}`,
    );
    expect(within(expanded).queryByText(/ago/i)).not.toBeInTheDocument();
    expect(within(expanded).queryByText(/DFS line updated/i)).not.toBeInTheDocument();
  });

  it("falls back book cell title to board lastUpdatedAt when changed_at is null", async () => {
    const user = userEvent.setup();
    const boardMs = Date.parse("2026-08-05T20:00:00Z");
    const withNullChanged = row({
      player_name: "Rhyne Howard",
      books: {
        ...howard.books,
        prophetx: {
          side: "over",
          fair_pct: 58.5,
          american: -140,
          changed_at: null,
          role: null,
        },
      },
    });
    render(
      <WnbaPropPicksList
        props={[withNullChanged]}
        format="power"
        legs={4}
        breakevenPct={54.3}
        lastUpdatedAt={boardMs}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Rhyne Howard/i }));
    const expanded = screen.getByTestId("wnba-prop-row-expand");
    const px = within(expanded).getByText("ProphetX").closest("div");
    expect(px).toHaveAttribute(
      "title",
      `Last updated ${formatWnbaPropPicksUpdatedAt(boardMs)}`,
    );
  });

  it("lays out expand books on two rows (not five-across)", async () => {
    const user = userEvent.setup();
    render(
      <WnbaPropPicksList
        props={[howard]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Rhyne Howard/i }));
    const expanded = screen.getByTestId("wnba-prop-row-expand");
    const booksGrid = within(expanded).getByText("ProphetX").closest(".grid");
    expect(booksGrid?.className).toMatch(/grid-cols-2/);
    expect(booksGrid?.className).toMatch(/sm:grid-cols-3/);
    expect(booksGrid?.className).not.toMatch(/lg:grid-cols-5/);
  });

  it("lays out props in independent columns with row-major rank order", () => {
    render(
      <WnbaPropPicksList
        props={[howard, noRead]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    const grid = screen.getByTestId("wnba-prop-picks-list");
    expect(grid.className).toMatch(/\bflex\b/);
    expect(grid.className).not.toMatch(/columns-/);
    expect(screen.getAllByTestId("wnba-prop-picks-column").length).toBeGreaterThanOrEqual(1);
  });

  it("paginates to 20 rows with next/previous", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: WNBA_PROP_PICKS_PAGE_SIZE + 3 }, (_, i) =>
      row({
        player_name: `Player ${i}`,
        stat: `Points ${i}`,
      }),
    );

    render(
      <WnbaPropPicksList
        props={many}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
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

describe("resolveBookLastUpdatedMs", () => {
  it("prefers changed_at over board", () => {
    expect(
      resolveBookLastUpdatedMs("2026-08-05T19:50:00Z", Date.parse("2026-08-05T20:00:00Z")),
    ).toBe(Date.parse("2026-08-05T19:50:00Z"));
  });
  it("falls back to board when changed_at null or invalid", () => {
    const board = Date.parse("2026-08-05T20:00:00Z");
    expect(resolveBookLastUpdatedMs(null, board)).toBe(board);
    expect(resolveBookLastUpdatedMs("not-a-date", board)).toBe(board);
  });
  it("returns null when neither available", () => {
    expect(resolveBookLastUpdatedMs(null, undefined)).toBeNull();
  });
});

describe("dfsOddsPayoutLabel", () => {
  it("formats american and payout together", () => {
    expect(
      dfsOddsPayoutLabel({
        line: 18.5,
        changed_at: null,
        american: -102,
        payout_multiplier: 1.05,
      }),
    ).toBe("-102 · 1.05×");
  });

  it("returns null when both missing", () => {
    expect(
      dfsOddsPayoutLabel({
        line: 18.5,
        changed_at: null,
        american: null,
        payout_multiplier: null,
      }),
    ).toBeNull();
  });
});
