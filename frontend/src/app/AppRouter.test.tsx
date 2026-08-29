import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRouter } from "@/app/AppRouter";

function renderWithProviders(initialEntries: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppRouter", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ date: "2026-07-29", fetched_at: "", games: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("redirects / to MLB matchups", async () => {
    renderWithProviders(["/"]);
    expect(
      await screen.findByRole("heading", { name: /^games$/i }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("matchups-header")).getByRole("link", {
        name: "MLB",
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("renders not found at /about", () => {
    renderWithProviders(["/about"]);
    expect(
      screen.getByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /about statvista/i }),
    ).not.toBeInTheDocument();
  });

  it("renders not found for unknown paths", () => {
    renderWithProviders(["/slate"]);
    expect(
      screen.getByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it("renders WNBA matchups hub at /wnba/matchups", async () => {
    renderWithProviders(["/wnba/matchups"]);
    expect(
      await screen.findByRole("heading", { name: "Games" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("matchups-header")).toBeInTheDocument();
    const header = screen.getByTestId("matchups-header");
    expect(within(header).getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(
      screen.queryByRole("heading", { name: /women.?s basketball/i }),
    ).not.toBeInTheDocument();
  });

  it("renders WNBA prop picks at /wnba/prop_picks", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        as_of: "now",
        sportsbooks: [
          "fanduel",
          "draftkings",
          "caesars",
          "betmgm",
          "pinnacle",
          "bet365",
          "prizepicks",
          "underdog",
          "betr",
          "novig",
          "sleeper",
          "betrivers",
        ],
        props: [
          {
            player_name: "Rhyne Howard",
            team_abbrev: "ATL",
            logo_url: "https://a.espncdn.com/i/teamlogos/wnba/500/atl.png",
            stat: "Assists",
            market_type: "player_assists",
            side: "over",
            model_prediction: null,
            over_under_pct: null,
            ev: null,
            game_date: "2026-07-31",
            commence_time: "2026-07-31T23:30:00Z",
            fanduel: { line: 3.5, odds_american: -114 },
            draftkings: { line: 3.5, odds_american: -120 },
            caesars: null,
            betmgm: null,
            pinnacle: { line: 3.5, odds_american: -108 },
            bet365: null,
            prizepicks: { line: 3.5, odds_american: null },
            underdog: null,
            betr: null,
            novig: null,
            sleeper: null,
            betrivers: null,
          },
        ],
      }),
    });
    renderWithProviders(["/wnba/prop_picks"]);
    expect(
      await screen.findByRole("heading", { name: "Props" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Rhyne Howard")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Props" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders player odds grid at /wnba/prop_picks/player/:playerSlug", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/wnba/props/today")) {
        return {
          ok: true,
          json: async () => ({
            as_of: "now",
            app: "prizepicks",
            format: "power",
            legs: 4,
            breakeven_pct: 54.3,
            props: [
              {
                player_name: "Caitlin Clark",
                team_abbrev: "IND",
                position: "G",
                headshot_url: null,
                commence_time: null,
                stat: "Points",
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
                dfs: {
                  line: 18.5,
                  changed_at: null,
                  american: null,
                  payout_multiplier: null,
                },
                fair_explain: "",
              },
              {
                player_name: "Caitlin Clark",
                team_abbrev: "IND",
                position: "G",
                headshot_url: null,
                commence_time: null,
                stat: "Assists",
                line: 8.5,
                recommended_side: "over",
                fair_pct: null,
                edge_pct: null,
                alt_edge_pct: null,
                source_tier: "no_sharp_read",
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
                  line: 8.5,
                  changed_at: null,
                  american: null,
                  payout_multiplier: null,
                },
                fair_explain: "",
              },
            ],
            error: null,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ date: "2026-07-29", fetched_at: "", games: [] }),
      };
    });

    renderWithProviders([
      "/wnba/prop_picks/player/caitlin-clark?app=prizepicks",
    ]);
    expect(await screen.findByText(/Caitlin Clark/i)).toBeInTheDocument();
    expect(screen.getByText(/Points/i)).toBeInTheDocument();
    expect(screen.getByText(/DraftKings/i)).toBeInTheDocument();
  });

  it("shows empty state for unknown WNBA player slug", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/wnba/props/today")) {
        return {
          ok: true,
          json: async () => ({
            as_of: "now",
            app: "prizepicks",
            format: "power",
            legs: 4,
            breakeven_pct: 54.3,
            props: [
              {
                player_name: "Caitlin Clark",
                team_abbrev: "IND",
                position: "G",
                headshot_url: null,
                commence_time: null,
                stat: "Points",
                line: 18.5,
                recommended_side: "over",
                fair_pct: null,
                edge_pct: null,
                alt_edge_pct: null,
                source_tier: "no_sharp_read",
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
                  line: 18.5,
                  changed_at: null,
                  american: null,
                  payout_multiplier: null,
                },
                fair_explain: "",
              },
            ],
            error: null,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ date: "2026-07-29", fetched_at: "", games: [] }),
      };
    });

    renderWithProviders(["/wnba/prop_picks/player/nobody?app=prizepicks"]);
    expect(
      await screen.findByText(/player not found|unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to prop picks/i }),
    ).toHaveAttribute("href", expect.stringMatching(/\/wnba\/prop_picks/));
  });

  it("renders NBA coming-soon hub at /nba/matchups", async () => {
    renderWithProviders(["/nba/matchups"]);
    expect(
      await screen.findByRole("heading", { name: "Games" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(
      within(screen.getByTestId("matchups-header")).getByRole("link", {
        name: "NBA",
      }),
    ).toHaveAttribute("href", "/nba/matchups");
    expect(
      screen.queryByRole("heading", { name: /men.?s basketball/i }),
    ).not.toBeInTheDocument();
  });

  it("renders MLB matchups hub at /mlb/matchups", async () => {
    renderWithProviders(["/mlb/matchups"]);
    expect(
      await screen.findByRole("heading", { name: /^games$/i }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("matchups-header")).getByRole("link", {
        name: "MLB",
      }),
    ).toHaveAttribute("href", "/mlb/matchups");
    expect(
      screen.queryByText(/MLB matchups coming soon/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /major league baseball/i }),
    ).not.toBeInTheDocument();
  });

  it("renders MLB Legs at /mlb/legs", async () => {
    renderWithProviders(["/mlb/legs"]);
    expect(
      await screen.findByRole("heading", { name: "Legs" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Legs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders MLB Arbitrage at /mlb/arbitrage", async () => {
    renderWithProviders(["/mlb/arbitrage"]);
    expect(
      await screen.findByRole("heading", { name: "Arbitrage" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Arbitrage" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders MLB prop picks at /mlb/prop_picks", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/mlb/props/board")) {
        return {
          ok: true,
          json: async () => ({
            as_of: "now",
            warnings: [],
            rows: [],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ date: "2026-07-29", fetched_at: "", games: [] }),
      };
    });

    renderWithProviders(["/mlb/prop_picks"]);

    expect(
      await screen.findByRole("heading", { name: "Props" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("No board yet")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "PrizePicks" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Props" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mlb/props/board",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("redirects /mlb/prop_picks/player/:playerSlug to the research board", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/mlb/props/board")) {
        return {
          ok: true,
          json: async () => ({
            as_of: "now",
            warnings: [],
            rows: [],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ date: "2026-07-29", fetched_at: "", games: [] }),
      };
    });

    renderWithProviders(["/mlb/prop_picks/player/aaron-judge?app=prizepicks"]);
    expect(
      await screen.findByRole("heading", { name: "Props" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("No board yet")).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-player-props-odds-grid")).not.toBeInTheDocument();
    expect(screen.queryByText(/DraftKings/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Strikeouts/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mlb/props/board",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("renders MLB game detail shell at /mlb/games/:gamePk", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/mlb/games/824971")) {
        return {
          ok: true,
          json: async () => ({
            mlb_game_pk: "824971",
            league: "mlb",
            status: "scheduled",
            status_label: "7:10 PM ET",
            venue: "Fenway Park",
            away: {
              id: "111",
              abbrev: "BOS",
              name: "Boston Red Sox",
              score: null,
              color: "#BD3039",
              logo_url: null,
            },
            home: {
              id: "119",
              abbrev: "LAD",
              name: "Los Angeles Dodgers",
              score: null,
              color: "#005A9C",
              logo_url: null,
            },
            linescore: null,
            situation: null,
            plays: [],
            scoring_plays: [],
            box_score: null,
            win_probability: null,
            hit_chart: [],
            sources: ["statsapi"],
            fetched_at: "",
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ date: "2026-07-29", fetched_at: "", games: [] }),
      };
    });
    renderWithProviders(["/mlb/games/824971"]);
    expect(
      await screen.findByTestId("mlb-pregame-center"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/MLB game detail coming soon/i),
    ).not.toBeInTheDocument();
  });

  it("renders game detail at /games/:espnEventId", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/wnba/games/")) {
        return {
          ok: true,
          json: async () => ({
            espn_event_id: "401857098",
            league: "wnba",
            status: "live",
            status_label: "4:13 - 1st",
            venue: "Mortgage Matchup Center",
            away: {
              id: "129153",
              abbrev: "GS",
              name: "Golden State Valkyries",
              score: 10,
              color: "#553987",
              logo_url: null,
            },
            home: {
              id: "21",
              abbrev: "PHX",
              name: "Phoenix Mercury",
              score: 9,
              color: "#E56020",
              logo_url: null,
            },
            fg_made: 1,
            fg_attempted: 2,
            latest_play: null,
            shots: [],
            plays: [],
            win_probability: null,
            matchup_prediction: null,
            projected_starters: null,
            season_leaders: null,
            injuries: null,
            box_score: null,
            fetched_at: "",
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ date: "2026-07-29", fetched_at: "", games: [] }),
      };
    });
    renderWithProviders(["/games/401857098"]);
    expect(await screen.findByTestId("wnba-live-center")).toBeInTheDocument();
    expect(screen.queryByText("No live games")).not.toBeInTheDocument();
  });

  it("renders not found for retired WNBA hub routes", () => {
    renderWithProviders(["/wnba/leaders"]);
    expect(
      screen.getByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it("renders win probability beneath shot chart and play-by-play", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/wnba/games/")) {
        return {
          ok: true,
          json: async () => ({
            espn_event_id: "401857098",
            league: "wnba",
            status: "live",
            status_label: "4:13 - 1st",
            venue: "Mortgage Matchup Center",
            away: {
              id: "129153",
              abbrev: "GS",
              name: "Golden State Valkyries",
              score: 10,
              color: "#553987",
              logo_url: null,
            },
            home: {
              id: "21",
              abbrev: "PHX",
              name: "Phoenix Mercury",
              score: 9,
              color: "#E56020",
              logo_url: null,
            },
            fg_made: 1,
            fg_attempted: 2,
            latest_play: null,
            shots: [],
            plays: [],
            win_probability: {
              summary: "Above the midline favors PHX",
              timeline: [
                {
                  id: "wp-1",
                  period: 1,
                  clock: "4:29",
                  away_score: 10,
                  home_score: 8,
                  away_win_pct: 46,
                  home_win_pct: 54,
                  team_id: "21",
                },
              ],
              team_stats: [
                {
                  key: "field_goal_pct",
                  label: "Field goal %",
                  away_value: 41,
                  home_value: 49,
                },
              ],
            },
            matchup_prediction: null,
            projected_starters: null,
            season_leaders: null,
            injuries: null,
            box_score: null,
            fetched_at: "",
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ date: "2026-07-29", fetched_at: "", games: [] }),
      };
    });

    renderWithProviders(["/games/401857098"]);

    expect(await screen.findByText("Shot chart")).toBeInTheDocument();
    expect(await screen.findByText("Scoring Plays")).toBeInTheDocument();
    expect(await screen.findByText("Game flow")).toBeInTheDocument();
    expect(screen.getByText("Field goal %")).toBeInTheDocument();
  });
});
