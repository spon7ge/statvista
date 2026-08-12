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

const howard = row({
  player_name: "Rhyne Howard",
  team_abbrev: "ATL",
  stat: "Points",
  recommended_side: "over",
  source_tier: "sharp_consensus",
});

const loyd = row({
  player_name: "Jewell Loyd",
  team_abbrev: "SEA",
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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/wnba/prop_picks"]}>
        <LeaguePropPicksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

  it("defaults the toolbar to prizepicks/power/4 and lists rows", () => {
    mockUseWnbaProps.mockReturnValue({
      data: {
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [howard, loyd],
        error: null,
      },
      isLoading: false,
      isError: false,
      isFetched: true,
      dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
    });

    renderPage();

    expect(mockUseWnbaProps).toHaveBeenCalledWith({
      app: "prizepicks",
      format: "power",
      legs: 4,
    });
    expect(screen.getByRole("heading", { name: "WNBA Props" })).toBeInTheDocument();
    expect(screen.getByText(/Rhyne Howard/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PrizePicks" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("4-pick")).toBeInTheDocument();
  });

  it("refetches via the hook when switching app and legs", async () => {
    const user = userEvent.setup();
    mockUseWnbaProps.mockReturnValue({
      data: {
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [howard],
        error: null,
      },
      isLoading: false,
      isError: false,
      isFetched: true,
      dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
    });

    renderPage();
    mockUseWnbaProps.mockClear();

    await user.click(screen.getByRole("tab", { name: "Underdog" }));
    expect(mockUseWnbaProps).toHaveBeenCalledWith({
      app: "underdog",
      format: "standard",
      legs: 4,
    });

    mockUseWnbaProps.mockClear();
    await user.click(screen.getByRole("button", { name: "More legs" }));
    expect(mockUseWnbaProps).toHaveBeenCalledWith({
      app: "underdog",
      format: "standard",
      legs: 5,
    });
    await user.click(screen.getByRole("button", { name: "More legs" }));
    expect(mockUseWnbaProps).toHaveBeenCalledWith({
      app: "underdog",
      format: "standard",
      legs: 6,
    });
  });

  it("filters the list by team via WnbaPropPicksFilters", async () => {
    const user = userEvent.setup();
    mockUseWnbaProps.mockReturnValue({
      data: {
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [howard, loyd],
        error: null,
      },
      isLoading: false,
      isError: false,
      isFetched: true,
      dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
    });

    renderPage();
    expect(screen.getByText("Rhyne Howard")).toBeInTheDocument();
    expect(screen.getByText("Jewell Loyd")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Team" }));
    await user.click(screen.getByRole("option", { name: "ATL" }));

    expect(screen.getByText("Rhyne Howard")).toBeInTheDocument();
    expect(screen.queryByText("Jewell Loyd")).not.toBeInTheDocument();
  });

  it("hides props for final games before client filters", () => {
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
    mockUseWnbaProps.mockReturnValue({
      data: {
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [howard, loyd],
        error: null,
      },
      isLoading: false,
      isError: false,
      isFetched: true,
      dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
    });

    renderPage();
    expect(screen.queryByText("Rhyne Howard")).not.toBeInTheDocument();
    expect(screen.getByText("Jewell Loyd")).toBeInTheDocument();
  });

  it("does not render Tier or Fresh sharp vs stale DFS filter controls", () => {
    mockUseWnbaProps.mockReturnValue({
      data: {
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [howard, loyd],
        error: null,
      },
      isLoading: false,
      isError: false,
      isFetched: true,
      dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
    });

    renderPage();
    expect(screen.getByRole("button", { name: "Stat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Side" })).toBeInTheDocument();
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
