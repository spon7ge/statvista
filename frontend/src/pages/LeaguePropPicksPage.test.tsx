import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ApiWnbaPropRow } from "@/shared/lib/api";
import { LeaguePropPicksPage } from "./LeaguePropPicksPage";

function row(
  partial: Partial<ApiWnbaPropRow> & Pick<ApiWnbaPropRow, "player_name">,
): ApiWnbaPropRow {
  return {
    team_abbrev: null,
    position: null,
    headshot_url: null,
    commence_time: "2026-08-11T23:00:00Z",
    stat: "Points",
    line: 18.5,
    recommended_side: "over",
    fair_pct: 58.2,
    edge_pct: 5.1,
    alt_edge_pct: -2.4,
    source_tier: "sharp_consensus",
    confidence_chips: [],
    sample_chips: [],
    recency_chip: "fresh_sharp_vs_stale_dfs",
    books: {
      prophetx: null,
      novig: null,
      draftkings: null,
      fanduel: null,
      pinnacle: null,
    },
    dfs: {
      line: 18.5,
      changed_at: null,
      american: null,
      payout_multiplier: null,
    },
    fair_explain: "PX+Novig agree within 2pp; 60/40 blend.",
    ...partial,
  };
}

const howardPoints = row({
  player_name: "Rhyne Howard",
  team_abbrev: "ATL",
  position: "G",
  stat: "Points",
  recommended_side: "over",
  source_tier: "sharp_consensus",
});

const howardAssists = row({
  player_name: "Rhyne Howard",
  team_abbrev: "ATL",
  position: "G",
  stat: "Assists",
  line: 4.5,
  recommended_side: "over",
  source_tier: "sharp_consensus",
});

const loyd = row({
  player_name: "Jewell Loyd",
  team_abbrev: "SEA",
  position: "G",
  stat: "Assists",
  recommended_side: "under",
  source_tier: "no_sharp_read",
  fair_pct: null,
  edge_pct: null,
  alt_edge_pct: null,
  recency_chip: null,
});

const mockUseWnbaProps = vi.fn();
const mockUseWnbaScoreboard = vi.fn();

vi.mock("@/features/basketball/hooks/useWnbaProps", () => ({
  useWnbaProps: (...args: unknown[]) => mockUseWnbaProps(...args),
}));

vi.mock("@/features/basketball/hooks/useWnbaScoreboard", () => ({
  useWnbaScoreboard: (...args: unknown[]) => mockUseWnbaScoreboard(...args),
}));

function renderPage(path = "/wnba/prop_picks") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <LeaguePropPicksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockBoard(props: ApiWnbaPropRow[]) {
  mockUseWnbaProps.mockReturnValue({
    data: {
      as_of: "now",
      app: "prizepicks",
      format: "power",
      legs: 4,
      breakeven_pct: 54.3,
      props,
      error: null,
    },
    isLoading: false,
    isError: false,
    isFetched: true,
    dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
  });
}

describe("LeaguePropPicksPage", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    mockUseWnbaScoreboard.mockReturnValue({
      games: [],
      data: { date: "2026-08-11", games: [], fetched_at: "" },
    });
  });

  it("hardcodes prizepicks/power/4 and shows player cards without format or legs", () => {
    mockBoard([howardPoints, howardAssists, loyd]);
    renderPage();

    expect(mockUseWnbaProps).toHaveBeenCalledWith({
      app: "prizepicks",
      format: "power",
      legs: 4,
    });
    expect(screen.getByRole("heading", { name: "Props" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PrizePicks" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Rhyne Howard")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View 2 props" })).toHaveAttribute(
      "href",
      "/wnba/prop_picks/player/rhyne-howard?app=prizepicks",
    );
    expect(screen.getByRole("link", { name: "View 1 prop" })).toBeInTheDocument();

    expect(screen.queryByText(/-pick/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Breakeven/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "More legs" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Side" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search player" })).toBeInTheDocument();
  });

  it("refetches via the hook when switching app, keeping legs at 4", async () => {
    const user = userEvent.setup();
    mockBoard([howardPoints]);

    renderPage();
    mockUseWnbaProps.mockClear();

    await user.click(screen.getByRole("tab", { name: "Underdog" }));
    expect(mockUseWnbaProps).toHaveBeenCalledWith({
      app: "underdog",
      format: "standard",
      legs: 4,
    });
  });

  it("initializes the Underdog tab from ?app=underdog", () => {
    mockBoard([howardPoints]);
    renderPage("/wnba/prop_picks?app=underdog");

    expect(screen.getByRole("tab", { name: "Underdog" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(mockUseWnbaProps).toHaveBeenCalledWith({
      app: "underdog",
      format: "standard",
      legs: 4,
    });
  });

  it("filters the board by team via WnbaPropPicksFilters", async () => {
    const user = userEvent.setup();
    mockBoard([howardPoints, loyd]);

    renderPage();
    expect(screen.getByText("Rhyne Howard")).toBeInTheDocument();
    expect(screen.getByText("Jewell Loyd")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Team" }));
    await user.click(screen.getByRole("option", { name: "ATL" }));

    expect(screen.getByText("Rhyne Howard")).toBeInTheDocument();
    expect(screen.queryByText("Jewell Loyd")).not.toBeInTheDocument();
  });

  it("filters the board by player name search", async () => {
    const user = userEvent.setup();
    mockBoard([howardPoints, loyd]);

    renderPage();
    await user.type(screen.getByRole("searchbox", { name: "Search player" }), "howard");

    expect(screen.getByText("Rhyne Howard")).toBeInTheDocument();
    expect(screen.queryByText("Jewell Loyd")).not.toBeInTheDocument();
  });

  it("hides props for final games before grouping", () => {
    mockUseWnbaScoreboard.mockReturnValue({
      games: [
        {
          status: "final",
          home: { abbrev: "ATL" },
          away: { abbrev: "CHI" },
        },
      ],
      data: { date: "2026-08-11", games: [], fetched_at: "" },
    });
    mockBoard([howardPoints, howardAssists, loyd]);

    renderPage();
    expect(screen.queryByText("Rhyne Howard")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View 2 props" })).not.toBeInTheDocument();
    expect(screen.getByText("Jewell Loyd")).toBeInTheDocument();
  });

  it("shows hide-past empty copy when API has props but all games are final", () => {
    mockUseWnbaScoreboard.mockReturnValue({
      games: [
        {
          status: "final",
          home: { abbrev: "ATL" },
          away: { abbrev: "CHI" },
        },
        {
          status: "final",
          home: { abbrev: "SEA" },
          away: { abbrev: "LV" },
        },
      ],
      data: { date: "2026-08-11", games: [], fetched_at: "" },
    });
    mockBoard([howardPoints, loyd]);

    renderPage();
    expect(screen.queryByText("Rhyne Howard")).not.toBeInTheDocument();
    expect(screen.queryByText("Jewell Loyd")).not.toBeInTheDocument();
    expect(
      screen.getByText("No props for today's remaining games."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Prop lines unavailable")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
  });

  it("does not render Stat, Side, Tier, or Fresh filter controls", () => {
    mockBoard([howardPoints, loyd]);
    renderPage();
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Side" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tier" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Fresh sharp vs stale DFS/i }),
    ).not.toBeInTheDocument();
  });

  it("shows loading, error, and empty states", () => {
    mockUseWnbaProps.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetched: false,
      dataUpdatedAt: 0,
    });
    const { rerender } = renderPage();
    expect(screen.getByLabelText("Loading WNBA prop picks")).toBeInTheDocument();

    mockUseWnbaProps.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetched: true,
      dataUpdatedAt: 0,
    });
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={["/wnba/prop_picks"]}>
          <LeaguePropPicksPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Prop lines unavailable")).toBeInTheDocument();

    mockUseWnbaProps.mockReturnValue({
      data: {
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [],
        error: null,
      },
      isLoading: false,
      isError: false,
      isFetched: true,
      dataUpdatedAt: 0,
    });
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={["/wnba/prop_picks"]}>
          <LeaguePropPicksPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByText("No PrizePicks board available."),
    ).toBeInTheDocument();
  });
});
