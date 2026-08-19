import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ApiMlbPropRow } from "@/shared/lib/api";
import { MlbPlayerPropsPage } from "./MlbPlayerPropsPage";

function row(
  partial: Partial<ApiMlbPropRow> & Pick<ApiMlbPropRow, "player_name" | "stat">,
): ApiMlbPropRow {
  return {
    team_abbrev: "NYY",
    position: "RF",
    headshot_url: null,
    line: 6.5,
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
      pinnacle: null,
    },
    dfs: {
      line: partial.line ?? 6.5,
      changed_at: null,
      american: null,
      payout_multiplier: null,
    },
    fair_explain: "",
    ...partial,
  };
}

const judgeKs = row({
  player_name: "Aaron Judge",
  stat: "Strikeouts",
  line: 6.5,
  books_main: {
    prophetx: {
      line: 6.5,
      over_american: -115,
      under_american: -105,
      changed_at: null,
    },
    novig: null,
    draftkings: {
      line: 7,
      over_american: -120,
      under_american: 100,
      changed_at: null,
    },
    fanduel: null,
    pinnacle: null,
  },
});

const judgeKsAltDfs = row({
  player_name: "Aaron Judge",
  stat: "Strikeouts",
  line: 7.5,
});

const judgeHits = row({
  player_name: "Aaron Judge",
  stat: "Hits",
  line: 1.5,
});

const mockUseMlbProps = vi.fn();

vi.mock("@/features/mlb/hooks/useMlbProps", () => ({
  useMlbProps: (...args: unknown[]) => mockUseMlbProps(...args),
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
            path="/mlb/prop_picks/player/:playerSlug"
            element={<MlbPlayerPropsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockBoard(props: ApiMlbPropRow[]) {
  mockUseMlbProps.mockReturnValue({
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

describe("MlbPlayerPropsPage", () => {
  beforeEach(() => {
    mockUseMlbProps.mockReset();
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

  it("renders player odds grid at /mlb/prop_picks/player/:playerSlug", () => {
    mockBoard([judgeKs, judgeKsAltDfs, judgeHits]);
    renderPage("/mlb/prop_picks/player/aaron-judge?app=prizepicks");

    expect(mockUseMlbProps).toHaveBeenCalledWith({
      app: "prizepicks",
      format: "power",
      legs: 4,
    });
    expect(screen.getByText(/Aaron Judge/i)).toBeInTheDocument();
    expect(screen.getByText(/Strikeouts/i)).toBeInTheDocument();
    expect(screen.getByText(/Hits/i)).toBeInTheDocument();
    expect(screen.getByText(/DraftKings/i)).toBeInTheDocument();
    expect(screen.getByText(/ProphetX/i)).toBeInTheDocument();
    expect(screen.getByText(/Novig/i)).toBeInTheDocument();
    expect(screen.getByText(/FanDuel/i)).toBeInTheDocument();
    expect(screen.getByText(/Pinnacle/i)).toBeInTheDocument();
    expect(screen.getByText("O 7 (-120)")).toBeInTheDocument();
    expect(screen.getByText("U 7 (+100)")).toBeInTheDocument();
    expect(screen.getAllByText("NL").length).toBeGreaterThan(0);
    expect(screen.queryByText("OPEN")).not.toBeInTheDocument();
    expect(screen.queryByText("BEST")).not.toBeInTheDocument();
    // One row per unique DFS stat; first Strikeouts line is the label.
    expect(screen.getByText("6.5")).toBeInTheDocument();
    expect(screen.queryByText("7.5")).not.toBeInTheDocument();
  });

  it("shows empty state for unknown slug", () => {
    mockBoard([judgeKs]);
    renderPage("/mlb/prop_picks/player/nobody?app=prizepicks");

    expect(screen.getByText(/player not found|unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to prop picks/i }),
    ).toHaveAttribute("href", expect.stringMatching(/\/mlb\/prop_picks/));
  });

  it("fetches Underdog with standard/4 defaults", () => {
    mockBoard([judgeKs]);
    renderPage("/mlb/prop_picks/player/aaron-judge?app=underdog");

    expect(mockUseMlbProps).toHaveBeenCalledWith({
      app: "underdog",
      format: "standard",
      legs: 4,
    });
  });
});
