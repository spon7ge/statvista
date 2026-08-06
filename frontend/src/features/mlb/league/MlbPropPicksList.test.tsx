import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiMlbPropRow } from "@/shared/lib/api";
import { MlbPropPicksList } from "./MlbPropPicksList";

function row(
  partial: Partial<ApiMlbPropRow> & Pick<ApiMlbPropRow, "player_name">,
): ApiMlbPropRow {
  return {
    team_abbrev: null,
    position: null,
    headshot_url: null,
    stat: "Total Bases",
    line: 1.5,
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
    dfs: { line: 1.5, changed_at: "2026-08-05T19:00:00Z" },
    fair_explain: "PX+Novig agree within 2pp; 60/40 blend.",
    ...partial,
  };
}

const judge = row({
  player_name: "Aaron Judge",
  team_abbrev: "NYY",
  source_tier: "sharp_consensus",
  recency_chip: "fresh_sharp_vs_stale_dfs",
});

const noRead = row({
  player_name: "Mookie Betts",
  team_abbrev: "LAD",
  stat: "Hits",
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

describe("MlbPropPicksList", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-08-05T20:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders PrizePicks-style collapsed card", () => {
    const enriched = row({
      player_name: "Aaron Judge",
      team_abbrev: "NYY",
      position: "RF",
      headshot_url:
        "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png",
      edge_pct: 5.1,
    });
    render(
      <MlbPropPicksList
        props={[enriched]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    const card = screen.getByTestId("mlb-prop-row");
    expect(within(card).getByRole("img", { name: /Aaron Judge/i })).toHaveAttribute(
      "src",
      expect.stringContaining("33192.png"),
    );
    expect(within(card).getByText("NYY · RF")).toBeInTheDocument();
    expect(within(card).getByText("Aaron Judge")).toBeInTheDocument();
    expect(within(card).getByText("1.5 Total Bases")).toBeInTheDocument();
    expect(within(card).getByText("Over")).toBeInTheDocument();
    expect(within(card).getByText("+5.1%").className).toMatch(/text-emerald-400/);
    expect(screen.queryByText(/PX\+Novig agree/i)).not.toBeInTheDocument();
  });

  it("uses initials placeholder when headshot missing", () => {
    render(
      <MlbPropPicksList
        props={[row({ player_name: "Aaron Judge", headshot_url: null })]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    expect(screen.queryByRole("img", { name: /Aaron Judge/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("mlb-prop-headshot-fallback")).toHaveTextContent("A");
  });

  it("colors negative edge red on collapsed row", () => {
    render(
      <MlbPropPicksList
        props={[
          row({
            player_name: "Juan Soto",
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
      <MlbPropPicksList
        props={[judge]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Aaron Judge/i }));

    expect(screen.getByText(/PX\+Novig agree within 2pp/i)).toBeInTheDocument();
    const expanded = screen.getByTestId("mlb-prop-row-expand");
    expect(within(expanded).getByText("ProphetX")).toBeInTheDocument();
    expect(within(expanded).getByText("Pinnacle")).toBeInTheDocument();
    expect(within(expanded).getByText(/cmp/i)).toBeInTheDocument();
  });

  it("renders No Sharp Read rows muted with edge em-dash, parked last", () => {
    render(
      <MlbPropPicksList
        props={[judge, noRead]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );

    const rows = screen.getAllByTestId("mlb-prop-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[1]!).getByText("Mookie Betts")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("1.5 Hits")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("No Sharp Read")).not.toBeInTheDocument();
    expect(rows[1]!.className).toMatch(/opacity-60/);
  });

  it("shows loading skeletons", () => {
    render(
      <MlbPropPicksList
        props={[]}
        format="power"
        legs={4}
        breakevenPct={null}
        isLoading
      />,
    );
    expect(screen.getByLabelText("Loading MLB prop picks")).toBeInTheDocument();
  });

  it("shows API error copy", () => {
    render(
      <MlbPropPicksList
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
      <MlbPropPicksList
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
      <MlbPropPicksList
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

  it("shows the fair/DFS/Pinnacle caption when rows are present", () => {
    render(
      <MlbPropPicksList
        props={[judge]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    expect(
      screen.getByText(
        "Fair from ProphetX/Novig (then DK/FD). DFS lines from PrizePicks/Underdog. Pinnacle comparison only.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the breakeven context for the selected format/legs", () => {
    render(
      <MlbPropPicksList
        props={[judge]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    expect(
      screen.getByText("Breakeven for 4-pick Power: 54.3%"),
    ).toBeInTheDocument();
  });

  it("lays out props row-major so highest edges fill across the top", () => {
    render(
      <MlbPropPicksList
        props={[judge, noRead]}
        format="power"
        legs={4}
        breakevenPct={54.3}
      />,
    );
    const grid = screen.getByTestId("mlb-prop-picks-grid");
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/md:grid-cols-2/);
    expect(grid.className).toMatch(/lg:grid-cols-3/);
    expect(grid.className).not.toMatch(/columns-/);
  });
});
