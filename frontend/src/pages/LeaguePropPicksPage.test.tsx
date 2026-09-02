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
    dfs: [{ book: "prizepicks", american: null, url: null }],
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

    expect(mockUseWnbaPropBoard).toHaveBeenCalledWith();
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
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
    const filters = screen.getByLabelText("WNBA prop picks filters");
    expect(within(filters).getByRole("button", { name: "Game" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Proposition" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Bookmaker" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Over/Under" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Hit rate" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search player" })).toBeInTheDocument();
  });

  it("filters the board by team", async () => {
    const user = userEvent.setup();
    mockBoard([clark, howard]);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Team" }));
    await user.click(screen.getByRole("option", { name: "IND" }));

    expect(screen.getByText("Caitlin Clark")).toBeInTheDocument();
    expect(screen.queryByText("Rhyne Howard")).not.toBeInTheDocument();
  });

  it("filters the board by game", async () => {
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

  it("shows No board yet when empty", () => {
    mockBoard([]);
    renderPage();
    expect(screen.getByText("No board yet")).toBeInTheDocument();
  });
});
