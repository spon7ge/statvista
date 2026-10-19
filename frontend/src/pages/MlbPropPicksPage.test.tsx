import { render, screen, within } from "@testing-library/react";
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
    game_start_at: "2099-08-23T23:10:00Z",
    anchor: {
      book: "prizepicks",
      american: -137,
      url: null,
      line: 1.5,
      devig_pct: null,
      over_american: -137,
      under_american: -137,
    },
    books: [{ book: "prophetx", american: -115, url: null }],
    ip_pct: 53,
    opp_def_rank: 12,
    opp_def_label: "12th BOS",
    opp_pace_rank: 4,
    opp_pace_label: "4th BOS",
    hit_l5: 80,
    hit_l10: 70,
    hit_l15: 60,
    hit_h2h: 50,
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
  game_pk: 2,
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
    mockUseMlbPropBoard.mockClear();
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

  it("hides props once the listed tip has passed", () => {
    const started = row({
      player_name: "Started Player",
      game_start_at: "2020-01-01T00:00:00Z",
      game_pk: 9,
    });
    mockBoard([judge, started]);
    renderPage();

    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.queryByText("Started Player")).not.toBeInTheDocument();
  });

  it("loads the research board without DFS tabs or View X props", () => {
    mockBoard([judge, betts]);
    renderPage();

    expect(mockUseMlbPropBoard).toHaveBeenCalledWith("prizepicks");
    expect(screen.getByRole("heading", { name: "Props" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Props" }).closest("section"),
    ).toHaveClass("max-w-6xl", "sm:pl-2", "md:pr-32");
    expect(
      screen.getByRole("heading", { name: "Props" }).closest("section"),
    ).not.toHaveClass("mx-auto");
    expect(screen.queryByRole("tab", { name: "PrizePicks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Underdog" })).not.toBeInTheDocument();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();
    expect(screen.getByText("Line")).toBeInTheDocument();
    expect(screen.getByText("IP")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View \d+ props?/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    ).toBeInTheDocument();
    const filters = screen.getByLabelText("MLB prop picks filters");
    expect(within(filters).getByRole("button", { name: "Game" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Proposition" })).toBeInTheDocument();
    expect(
      within(filters).getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    ).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Over/Under" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Hit rate" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search player" })).toBeInTheDocument();
  });

  it("requests the book from the page URL", () => {
    mockBoard([judge]);
    renderPage("/mlb/prop_picks?book=draftkings");
    expect(mockUseMlbPropBoard).toHaveBeenCalledWith("draftkings");
    expect(mockUseMlbPropBoard.mock.calls[0]).toEqual(["draftkings"]);
  });

  it("filters the board by game via MlbPropPicksFilters", async () => {
    const user = userEvent.setup();
    mockBoard([judge, betts]);

    renderPage();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();

    const filters = screen.getByLabelText("MLB prop picks filters");
    await user.click(within(filters).getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("option", { name: "NYY @ BOS" }));

    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.queryByText("Mookie Betts")).not.toBeInTheDocument();
  });

  it("filters the board to props posted by a chosen number of books", async () => {
    const user = userEvent.setup();
    const solo = row({ player_name: "Juan Soto", books: [] });
    mockBoard([judge, solo]);

    renderPage();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Juan Soto")).toBeInTheDocument();

    const filters = screen.getByLabelText("MLB prop picks filters");
    await user.click(within(filters).getByRole("button", { name: "Books" }));
    await user.click(screen.getByRole("option", { name: "1 book" }));

    expect(screen.getByText("Juan Soto")).toBeInTheDocument();
    expect(screen.queryByText("Aaron Judge")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Juan Soto")).toBeInTheDocument();
  });

  it("filters the board by player name search", async () => {
    const user = userEvent.setup();
    mockBoard([judge, betts]);

    renderPage();
    await user.type(screen.getByRole("searchbox", { name: "Search player" }), "judge");

    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.queryByText("Mookie Betts")).not.toBeInTheDocument();
  });

  it("choosing DraftKings requests that book from the hook", async () => {
    const user = userEvent.setup();
    mockBoard([judge, betts]);
    renderPage();
    expect(mockUseMlbPropBoard).toHaveBeenCalledWith("prizepicks");

    const filters = screen.getByLabelText("MLB prop picks filters");
    await user.click(
      within(filters).getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    );
    await user.click(screen.getByRole("option", { name: "DraftKings" }));

    expect(mockUseMlbPropBoard).toHaveBeenCalledWith("draftkings");
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();
  });

  it("filters the board by proposition, over/under, and hit-rate sort", async () => {
    const user = userEvent.setup();
    const ohtani = row({
      player_name: "Shohei Ohtani",
      team_abbrev: "LAD",
      opponent_abbrev: "SF",
      stat: "strikeouts",
      market_label: "Over 6.5 Strikeouts",
      side: "over",
      line: 6.5,
      hit_l5: 90,
    });
    mockBoard([judge, betts, ohtani]);
    renderPage();
    const filters = screen.getByLabelText("MLB prop picks filters");

    await user.click(within(filters).getByRole("button", { name: "Proposition" }));
    await user.click(screen.getByRole("option", { name: "Hits" }));
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();
    expect(screen.queryByText("Shohei Ohtani")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Over/Under" }));
    await user.click(screen.getByRole("option", { name: "Over" }));
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.queryByText("Mookie Betts")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.click(screen.getByRole("button", { name: "Hit rate" }));
    await user.click(screen.getByRole("option", { name: "L5" }));
    expect(screen.getAllByTestId("board-row-name").map((el) => el.textContent)).toEqual([
      "Shohei Ohtani",
      "Aaron Judge",
      "Mookie Betts",
    ]);
  });

  it("does not render Stat, Side, Tier, or Fresh filter controls", () => {
    mockBoard([judge, betts]);
    renderPage();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
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
    expect(
      screen.getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    ).toBeInTheDocument();
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
