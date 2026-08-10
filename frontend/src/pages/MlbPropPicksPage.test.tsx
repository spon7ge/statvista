import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ApiMlbPropRow } from "@/shared/lib/api";
import { MlbPropPicksPage } from "./MlbPropPicksPage";

function row(
  partial: Partial<ApiMlbPropRow> & Pick<ApiMlbPropRow, "player_name">,
): ApiMlbPropRow {
  return {
    team_abbrev: null,
    stat: "Total Bases",
    line: 1.5,
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
      line: 1.5,
      changed_at: null,
      american: null,
      payout_multiplier: null,
    },
    fair_explain: "PX+Novig agree within 2pp; 60/40 blend.",
    ...partial,
  };
}

const judge = row({
  player_name: "Aaron Judge",
  team_abbrev: "NYY",
  stat: "Total Bases",
  recommended_side: "over",
  source_tier: "sharp_consensus",
});

const betts = row({
  player_name: "Mookie Betts",
  team_abbrev: "LAD",
  stat: "Hits",
  recommended_side: "under",
  source_tier: "no_sharp_read",
  fair_pct: null,
  edge_pct: null,
  alt_edge_pct: null,
  recency_chip: null,
});

const mockUseMlbProps = vi.fn();

vi.mock("@/features/mlb/hooks/useMlbProps", () => ({
  useMlbProps: (...args: unknown[]) => mockUseMlbProps(...args),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/mlb/prop_picks"]}>
        <MlbPropPicksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MlbPropPicksPage", () => {
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
  });

  it("defaults the toolbar to prizepicks/power/4 and lists rows", () => {
    mockUseMlbProps.mockReturnValue({
      data: {
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [judge, betts],
        error: null,
      },
      isLoading: false,
      isError: false,
      isFetched: true,
      dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
    });

    renderPage();

    expect(mockUseMlbProps).toHaveBeenCalledWith({
      app: "prizepicks",
      format: "power",
      legs: 4,
    });
    expect(screen.getByRole("heading", { name: "MLB Props" })).toBeInTheDocument();
    expect(screen.getByText(/Aaron Judge/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PrizePicks" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("4-pick")).toBeInTheDocument();
  });

  it("refetches via the hook when switching app and legs", async () => {
    const user = userEvent.setup();
    mockUseMlbProps.mockReturnValue({
      data: {
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [judge],
        error: null,
      },
      isLoading: false,
      isError: false,
      isFetched: true,
      dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
    });

    renderPage();
    mockUseMlbProps.mockClear();

    await user.click(screen.getByRole("tab", { name: "Underdog" }));
    expect(mockUseMlbProps).toHaveBeenCalledWith({
      app: "underdog",
      format: "standard",
      legs: 4,
    });

    mockUseMlbProps.mockClear();
    await user.click(screen.getByRole("button", { name: "More legs" }));
    expect(mockUseMlbProps).toHaveBeenCalledWith({
      app: "underdog",
      format: "standard",
      legs: 5,
    });
    await user.click(screen.getByRole("button", { name: "More legs" }));
    expect(mockUseMlbProps).toHaveBeenCalledWith({
      app: "underdog",
      format: "standard",
      legs: 6,
    });
  });

  it("filters the list by team via MlbPropPicksFilters", async () => {
    const user = userEvent.setup();
    mockUseMlbProps.mockReturnValue({
      data: {
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [judge, betts],
        error: null,
      },
      isLoading: false,
      isError: false,
      isFetched: true,
      dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
    });

    renderPage();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Team" }));
    await user.click(screen.getByRole("option", { name: "NYY" }));

    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.queryByText("Mookie Betts")).not.toBeInTheDocument();
  });

  it("does not render Tier or Fresh sharp vs stale DFS filter controls", () => {
    mockUseMlbProps.mockReturnValue({
      data: {
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [judge, betts],
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
    mockUseMlbProps.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetched: false,
      dataUpdatedAt: 0,
    });
    const { rerender } = renderPage();
    expect(screen.getByLabelText("Loading MLB prop picks")).toBeInTheDocument();

    mockUseMlbProps.mockReturnValue({
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
        <MemoryRouter initialEntries={["/mlb/prop_picks"]}>
          <MlbPropPicksPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Prop lines unavailable")).toBeInTheDocument();

    mockUseMlbProps.mockReturnValue({
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
        <MemoryRouter initialEntries={["/mlb/prop_picks"]}>
          <MlbPropPicksPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByText("No PrizePicks board available."),
    ).toBeInTheDocument();
  });
});
