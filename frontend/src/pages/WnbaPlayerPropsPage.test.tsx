import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ApiWnbaPropRow } from "@/shared/lib/api";
import { WnbaPlayerPropsPage } from "./WnbaPlayerPropsPage";

function row(
  partial: Partial<ApiWnbaPropRow> & Pick<ApiWnbaPropRow, "player_name" | "stat">,
): ApiWnbaPropRow {
  return {
    team_abbrev: "IND",
    position: "G",
    headshot_url: null,
    commence_time: null,
    line: 18.5,
    recommended_side: "over",
    fair_pct: 58.2,
    edge_pct: 5.1,
    alt_edge_pct: null,
    source_tier: "sharp_consensus",
    confidence_chips: [],
    sample_chips: [],
    recency_chip: null,
    books: {
      prophetx: null,
      novig: null,
      draftkings: null,
      fanduel: null,
      pinnacle: null,
    },
    books_main: {
      prophetx: null,
      novig: null,
      draftkings: null,
      fanduel: null,
      betmgm: null,
      caesars: null,
      kalshi: null,
      fliff: null,
      bet365: null,
      pinnacle: null,
    },
    dfs: {
      line: partial.line ?? 18.5,
      changed_at: null,
      american: null,
      payout_multiplier: null,
    },
    fair_explain: "",
    ...partial,
  };
}

const clarkPoints = row({
  player_name: "Caitlin Clark",
  stat: "Points",
  line: 18.5,
  books_main: {
    prophetx: {
      line: 18.5,
      over_american: -115,
      under_american: -105,
      changed_at: null,
    },
    novig: null,
    draftkings: {
      line: 19.5,
      over_american: -120,
      under_american: 100,
      changed_at: null,
    },
    fanduel: null,
    betmgm: null,
    caesars: null,
    kalshi: null,
    fliff: null,
    bet365: null,
    pinnacle: null,
  },
});

const clarkPointsAltDfs = row({
  player_name: "Caitlin Clark",
  stat: "Points",
  line: 20.5,
});

const clarkAssists = row({
  player_name: "Caitlin Clark",
  stat: "Assists",
  line: 8.5,
});

const mockUseWnbaProps = vi.fn();

vi.mock("@/features/basketball/hooks/useWnbaProps", () => ({
  useWnbaProps: (...args: unknown[]) => mockUseWnbaProps(...args),
}));

function renderPage(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/wnba/prop_picks/player/:playerSlug"
            element={<WnbaPlayerPropsPage />}
          />
        </Routes>
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
    dataUpdatedAt: Date.UTC(2026, 7, 19, 16, 0),
  });
}

describe("WnbaPlayerPropsPage", () => {
  beforeEach(() => {
    mockUseWnbaProps.mockReset();
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

  it("renders player odds grid at /wnba/prop_picks/player/:playerSlug", async () => {
    mockBoard([clarkPoints, clarkPointsAltDfs, clarkAssists]);
    renderPage("/wnba/prop_picks/player/caitlin-clark?app=prizepicks");

    expect(mockUseWnbaProps).toHaveBeenCalledWith({
      app: "prizepicks",
      format: "power",
      legs: 4,
    });
    expect(await screen.findByText(/Caitlin Clark/i)).toBeInTheDocument();
    expect(screen.getByText(/Points/i)).toBeInTheDocument();
    expect(screen.getByText(/Assists/i)).toBeInTheDocument();
    expect(screen.getByText(/DraftKings/i)).toBeInTheDocument();
    expect(screen.getByText(/ProphetX/i)).toBeInTheDocument();
    expect(screen.getByText(/Novig/i)).toBeInTheDocument();
    expect(screen.getByText(/FanDuel/i)).toBeInTheDocument();
    expect(screen.getByText(/Kalshi/i)).toBeInTheDocument();
    expect(screen.getByText(/Fliff/i)).toBeInTheDocument();
    expect(screen.getByText(/Pinnacle/i)).toBeInTheDocument();
    expect(screen.getByTestId("wnba-player-props-odds-grid")).toHaveTextContent(
      /O\s*19\.5/,
    );
    expect(screen.getByTestId("wnba-player-props-odds-grid")).toHaveTextContent(
      /U\s*19\.5/,
    );
    expect(screen.getAllByText("NL").length).toBeGreaterThan(0);
    expect(screen.queryByText("OPEN")).not.toBeInTheDocument();
    expect(screen.queryByText("BEST")).not.toBeInTheDocument();
    // One row per unique DFS stat; first Points line is the label.
    expect(screen.getByText("18.5")).toBeInTheDocument();
    expect(screen.queryByText("20.5")).not.toBeInTheDocument();
  });

  it("shows empty state for unknown slug", async () => {
    mockBoard([clarkPoints]);
    renderPage("/wnba/prop_picks/player/nobody?app=prizepicks");

    expect(
      await screen.findByText(/not found|unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to prop picks/i }),
    ).toHaveAttribute("href", expect.stringMatching(/\/wnba\/prop_picks/));
  });

  it("fetches Underdog with standard/4 defaults", async () => {
    mockBoard([clarkPoints]);
    renderPage("/wnba/prop_picks/player/caitlin-clark?app=underdog");

    expect(mockUseWnbaProps).toHaveBeenCalledWith({
      app: "underdog",
      format: "standard",
      legs: 4,
    });
  });
});
