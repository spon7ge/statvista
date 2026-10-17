import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiNbaPropBoardRow } from "@/shared/lib/api";
import { NbaPropPicksPage } from "./NbaPropPicksPage";

const mockUseNbaPropBoard = vi.fn();

vi.mock("@/features/nba/hooks/useNbaPropBoard", () => ({
  useNbaPropBoard: (...args: unknown[]) => mockUseNbaPropBoard(...args),
}));

const tatum: ApiNbaPropBoardRow = {
  player_name: "Jayson Tatum",
  headshot_url: null,
  team_abbrev: "BOS",
  opponent_abbrev: "NYK",
  home_away: "away",
  stat: "points",
  market_label: "Over 27.5 Points",
  side: "over",
  line: 27.5,
  game_id: "401810001",
  game_start_at: "2099-10-23T23:30:00Z",
  anchor: {
    book: "prizepicks",
    american: -137,
    url: null,
    line: 27.5,
    devig_pct: null,
    over_american: -137,
    under_american: -137,
  },
  books: [{ book: "draftkings", american: -110, url: null, line: 27.5 }],
  ip_pct: 55,
  opp_def_rank: null,
  opp_def_label: null,
  opp_pace_rank: null,
  opp_pace_label: null,
  hit_l5: 80,
  hit_l10: 70,
  hit_l15: 60,
  hit_h2h: 50,
};

function LocationSearch() {
  return <output aria-label="location search">{useLocation().search}</output>;
}

function renderPage(path = "/nba/prop_picks") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <NbaPropPicksPage />
        <LocationSearch />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NbaPropPicksPage", () => {
  beforeEach(() => {
    mockUseNbaPropBoard.mockReset();
    mockUseNbaPropBoard.mockReturnValue({
      data: { as_of: "now", warnings: [], rows: [tatum] },
      isLoading: false,
      isError: false,
    });
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

  it("defaults to PrizePicks and exposes only the seven NBA books", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(mockUseNbaPropBoard).toHaveBeenCalledWith("prizepicks");
    expect(screen.getByRole("heading", { name: "Props" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Proposition" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Line" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Odds" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "IP" })).toBeInTheDocument();
    expect(screen.queryByText("DFS")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();

    const filters = screen.getByLabelText("NBA prop picks filters");
    await user.click(
      within(filters).getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    );
    expect(screen.getAllByRole("option")).toHaveLength(7);
    for (const book of [
      "ProphetX",
      "Novig",
      "Pinnacle",
      "DraftKings",
      "FanDuel",
      "PrizePicks",
      "Underdog",
    ]) {
      expect(screen.getByRole("option", { name: book })).toBeInTheDocument();
    }
    expect(screen.queryByRole("option", { name: "BetMGM" })).not.toBeInTheDocument();
  });

  it("sets the book query parameter when DraftKings is chosen", async () => {
    const user = userEvent.setup();
    renderPage();

    const filters = screen.getByLabelText("NBA prop picks filters");
    await user.click(
      within(filters).getByRole("button", { name: "Bookmaker (PrizePicks)" }),
    );
    await user.click(screen.getByRole("option", { name: "DraftKings" }));

    expect(mockUseNbaPropBoard).toHaveBeenLastCalledWith("draftkings");
    expect(screen.getByLabelText("location search")).toHaveTextContent(
      "?book=draftkings",
    );
  });

  it("clears the book query parameter when PrizePicks is chosen", async () => {
    const user = userEvent.setup();
    renderPage("/nba/prop_picks?book=draftkings");

    const filters = screen.getByLabelText("NBA prop picks filters");
    await user.click(
      within(filters).getByRole("button", { name: "Bookmaker (DraftKings)" }),
    );
    await user.click(screen.getByRole("option", { name: "PrizePicks" }));

    expect(mockUseNbaPropBoard).toHaveBeenLastCalledWith("prizepicks");
    expect(screen.getByLabelText("location search")).toBeEmptyDOMElement();
  });
});
