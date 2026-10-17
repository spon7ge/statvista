import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ApiWnbaPropBoardRow } from "@/shared/lib/api";
import { LeaguePropPicksPage } from "./LeaguePropPicksPage";

function row(
  over: Partial<ApiWnbaPropBoardRow> = {},
): ApiWnbaPropBoardRow {
  return {
    player_name: "Caitlin Clark",
    headshot_url: null,
    team_abbrev: "IND",
    opponent_abbrev: "NYL",
    home_away: "away",
    stat: "points",
    market_label: "Over 18.5 Points",
    side: "over",
    line: 18.5,
    game_id: "401810001",
    game_start_at: "2026-08-23T23:10:00Z",
    anchor: {
      book: "prizepicks",
      american: -137,
      url: null,
      line: 18.5,
      devig_pct: null,
      over_american: -137,
      under_american: -137,
    },
    books: [{ book: "prophetx", american: -115, url: null }],
    ip_pct: 53,
    opp_def_rank: null,
    opp_def_label: null,
    opp_pace_rank: null,
    opp_pace_label: null,
    hit_l5: 80,
    hit_l10: 70,
    hit_l15: 60,
    hit_h2h: 50,
    ...over,
  };
}

const clark = row();
const howard = row({
  player_name: "Rhyne Howard",
  team_abbrev: "ATL",
  opponent_abbrev: "CHI",
  market_label: "Under 4.5 Assists",
  stat: "assists",
  side: "under",
  line: 4.5,
  game_id: "401810002",
});

const mockUseWnbaPropBoard = vi.fn();

vi.mock("@/features/basketball/hooks/useWnbaPropBoard", () => ({
  useWnbaPropBoard: (...args: unknown[]) => mockUseWnbaPropBoard(...args),
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

function mockBoard(rows: ApiWnbaPropBoardRow[]) {
  mockUseWnbaPropBoard.mockReturnValue({
    data: {
      as_of: "now",
      warnings: [],
      rows,
    },
    isLoading: false,
    isError: false,
    isFetched: true,
    dataUpdatedAt: Date.UTC(2026, 7, 31, 20, 0),
  });
}

describe("LeaguePropPicksPage", () => {
  beforeEach(() => {
    mockUseWnbaPropBoard.mockClear();
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
    mockBoard([clark, howard]);
    renderPage();

    expect(mockUseWnbaPropBoard).toHaveBeenCalledWith("prizepicks");
    expect(screen.getByRole("heading", { name: "Props" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Props" }).closest("section"),
    ).toHaveClass("max-w-6xl", "sm:pl-2", "md:pr-32");
    expect(screen.queryByRole("tab", { name: "PrizePicks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Underdog" })).not.toBeInTheDocument();
    expect(screen.getByText("Caitlin Clark")).toBeInTheDocument();
    expect(screen.getByText("Rhyne Howard")).toBeInTheDocument();
    expect(screen.getByText("Line")).toBeInTheDocument();
    expect(screen.getByText("IP")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View \d+ props?/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    ).toBeInTheDocument();
    const filters = screen.getByLabelText("WNBA prop picks filters");
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
    mockBoard([clark]);
    renderPage("/wnba/prop_picks?book=draftkings");
    expect(mockUseWnbaPropBoard).toHaveBeenCalledWith("draftkings");
    expect(mockUseWnbaPropBoard.mock.calls[0]).toEqual(["draftkings"]);
  });

  it("filters the board by game via WnbaPropPicksFilters", async () => {
    const user = userEvent.setup();
    mockBoard([clark, howard]);
    renderPage();

    const filters = screen.getByLabelText("WNBA prop picks filters");
    await user.click(within(filters).getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("option", { name: "IND @ NYL" }));

    expect(screen.getByText("Caitlin Clark")).toBeInTheDocument();
    expect(screen.queryByText("Rhyne Howard")).not.toBeInTheDocument();
  });

  it("filters the board by player name search", async () => {
    const user = userEvent.setup();
    mockBoard([clark, howard]);
    renderPage();
    await user.type(screen.getByRole("searchbox", { name: "Search player" }), "clark");

    expect(screen.getByText("Caitlin Clark")).toBeInTheDocument();
    expect(screen.queryByText("Rhyne Howard")).not.toBeInTheDocument();
  });

  it("choosing DraftKings requests that book from the hook", async () => {
    const user = userEvent.setup();
    mockBoard([clark, howard]);
    renderPage();
    expect(mockUseWnbaPropBoard).toHaveBeenCalledWith("prizepicks");

    const filters = screen.getByLabelText("WNBA prop picks filters");
    await user.click(
      within(filters).getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    );
    await user.click(screen.getByRole("option", { name: "DraftKings" }));

    expect(mockUseWnbaPropBoard).toHaveBeenCalledWith("draftkings");
    expect(screen.getByText("Caitlin Clark")).toBeInTheDocument();
    expect(screen.getByText("Rhyne Howard")).toBeInTheDocument();
  });

  it("filters the board by proposition, over/under, and hit-rate sort", async () => {
    const user = userEvent.setup();
    const wilson = row({
      player_name: "A'ja Wilson",
      team_abbrev: "LV",
      opponent_abbrev: "SEA",
      stat: "rebounds",
      market_label: "Over 10.5 Rebounds",
      side: "over",
      line: 10.5,
      hit_l5: 90,
    });
    mockBoard([clark, howard, wilson]);
    renderPage();
    const filters = screen.getByLabelText("WNBA prop picks filters");

    await user.click(within(filters).getByRole("button", { name: "Proposition" }));
    await user.click(screen.getByRole("option", { name: "Points" }));
    expect(screen.getByText("Caitlin Clark")).toBeInTheDocument();
    expect(screen.queryByText("Rhyne Howard")).not.toBeInTheDocument();
    expect(screen.queryByText("A'ja Wilson")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Over/Under" }));
    await user.click(screen.getByRole("option", { name: "Over" }));
    expect(screen.getByText("Caitlin Clark")).toBeInTheDocument();
    expect(screen.queryByText("Rhyne Howard")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.click(screen.getByRole("button", { name: "Hit rate" }));
    await user.click(screen.getByRole("option", { name: "L5" }));
    expect(screen.getAllByTestId("board-row-name").map((el) => el.textContent)).toEqual([
      "A'ja Wilson",
      "Caitlin Clark",
      "Rhyne Howard",
    ]);
  });

  it("does not render Stat, Side, Tier, or Fresh filter controls", () => {
    mockBoard([clark, howard]);
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
    mockUseWnbaPropBoard.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetched: false,
      dataUpdatedAt: 0,
    });
    const { rerender } = renderPage();
    expect(screen.getByLabelText("Loading WNBA prop picks")).toBeInTheDocument();

    mockUseWnbaPropBoard.mockReturnValue({
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

    mockUseWnbaPropBoard.mockReturnValue({
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
        <MemoryRouter initialEntries={["/wnba/prop_picks"]}>
          <LeaguePropPicksPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("No board yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    ).toBeInTheDocument();
  });

  it("keeps a cached board visible when a background refetch fails", () => {
    mockUseWnbaPropBoard.mockReturnValue({
      data: {
        as_of: "now",
        warnings: [],
        rows: [clark],
      },
      isLoading: false,
      isError: true,
      isFetched: true,
      dataUpdatedAt: Date.UTC(2026, 7, 31, 20, 0),
    });
    renderPage();

    expect(screen.getByText("Caitlin Clark")).toBeInTheDocument();
    expect(screen.queryByText("Prop lines unavailable")).not.toBeInTheDocument();
  });
});
