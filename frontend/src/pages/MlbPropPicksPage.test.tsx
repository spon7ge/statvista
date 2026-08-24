import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ApiMlbPropBoardRow } from "@/shared/lib/api";
import { MlbPropPicksPage } from "./MlbPropPicksPage";

function row(
  over: Partial<ApiMlbPropBoardRow> = {},
): ApiMlbPropBoardRow {
  return {
    player_name: "Aaron Judge",
    headshot_url: null,
    team_abbrev: "NYY",
    opponent_abbrev: "BOS",
    home_away: "away",
    stat: "hits",
    market_label: "Over 1.5 Hits",
    side: "over",
    line: 1.5,
    game_pk: 1,
    game_start_at: "2026-08-23T23:10:00Z",
    books: [{ book: "prophetx", american: -115, url: null }],
    ip_pct: 53,
    opp_def_rank: 12,
    opp_def_label: "12th BOS",
    opp_pace_rank: 4,
    opp_pace_label: "4th BOS",
    hit_l5: 80,
    hit_l10: 70,
    hit_l15: 60,
    ...over,
  };
}

const judge = row();
const betts = row({
  player_name: "Mookie Betts",
  team_abbrev: "LAD",
  opponent_abbrev: "SF",
  market_label: "Under 0.5 Hits",
  side: "under",
  line: 0.5,
});

const mockUseMlbPropBoard = vi.fn();

vi.mock("@/features/mlb/hooks/useMlbPropBoard", () => ({
  useMlbPropBoard: (...args: unknown[]) => mockUseMlbPropBoard(...args),
}));

function renderPage(path = "/mlb/prop_picks") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <MlbPropPicksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockBoard(rows: ApiMlbPropBoardRow[]) {
  mockUseMlbPropBoard.mockReturnValue({
    data: {
      as_of: "now",
      warnings: [],
      rows,
    },
    isLoading: false,
    isError: false,
    isFetched: true,
    dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
  });
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

  it("loads the research board without DFS tabs or View X props", () => {
    mockBoard([judge, betts]);
    renderPage();

    expect(mockUseMlbPropBoard).toHaveBeenCalledWith();
    expect(screen.getByRole("heading", { name: "MLB Props" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "PrizePicks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Underdog" })).not.toBeInTheDocument();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();
    expect(screen.getByText("Line")).toBeInTheDocument();
    expect(screen.getByText("IP")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View \d+ props?/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search player" })).toBeInTheDocument();
  });

  it("filters the board by team via MlbPropPicksFilters", async () => {
    const user = userEvent.setup();
    mockBoard([judge, betts]);

    renderPage();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Team" }));
    await user.click(screen.getByRole("option", { name: "NYY" }));

    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.queryByText("Mookie Betts")).not.toBeInTheDocument();
  });

  it("filters the board by player name search", async () => {
    const user = userEvent.setup();
    mockBoard([judge, betts]);

    renderPage();
    await user.type(screen.getByRole("searchbox", { name: "Search player" }), "judge");

    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.queryByText("Mookie Betts")).not.toBeInTheDocument();
  });

  it("does not render Stat, Side, Tier, or Fresh filter controls", () => {
    mockBoard([judge, betts]);
    renderPage();
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Side" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tier" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Fresh sharp vs stale DFS/i }),
    ).not.toBeInTheDocument();
  });

  it("shows loading, error, and empty states", () => {
    mockUseMlbPropBoard.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetched: false,
      dataUpdatedAt: 0,
    });
    const { rerender } = renderPage();
    expect(screen.getByLabelText("Loading MLB prop picks")).toBeInTheDocument();

    mockUseMlbPropBoard.mockReturnValue({
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

    mockUseMlbPropBoard.mockReturnValue({
      data: {
        as_of: "now",
        warnings: [],
        rows: [],
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
    expect(screen.getByText("No board yet")).toBeInTheDocument();
  });

  it("keeps a cached board visible when a background refetch fails", () => {
    mockUseMlbPropBoard.mockReturnValue({
      data: {
        as_of: "now",
        warnings: [],
        rows: [judge],
      },
      isLoading: false,
      isError: true,
      isFetched: true,
      dataUpdatedAt: Date.UTC(2026, 7, 5, 20, 0),
    });
    renderPage();

    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.queryByText("Prop lines unavailable")).not.toBeInTheDocument();
  });
});
