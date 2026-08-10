import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MlbPregameCenter } from "./MlbPregameCenter";
import { mlbScheduledDetail } from "../lib/testFixtures";
import type {
  ApiMlbGamePropsResponse,
  ApiMlbLineupGame,
  ApiMlbLineupMatchupResponse,
  ApiMlbOddsResponse,
} from "@/shared/lib/api";

const fetchMlbLineups = vi.fn();
const fetchMlbGameProps = vi.fn();
const useMlbLineupMatchup = vi.fn(() => ({
  data: null as ApiMlbLineupMatchupResponse | null,
}));
const useMlbOdds = vi.fn(() => ({ data: null as ApiMlbOddsResponse | null }));

vi.mock("@/shared/lib/api", () => ({
  fetchMlbLineups: (...args: unknown[]) => fetchMlbLineups(...args),
  fetchMlbGameProps: (...args: unknown[]) => fetchMlbGameProps(...args),
}));

vi.mock("@/features/mlb/hooks/useMlbLineupMatchup", () => ({
  useMlbLineupMatchup: (...args: unknown[]) => useMlbLineupMatchup(...args),
}));

vi.mock("@/features/mlb/hooks/useMlbOdds", () => ({
  useMlbOdds: (...args: unknown[]) => useMlbOdds(...args),
}));

const emptyGameProps: ApiMlbGamePropsResponse = {
  as_of: null,
  app: "prizepicks",
  game_pk: mlbScheduledDetail.mlbGamePk,
  away_abbrev: null,
  home_abbrev: null,
  categories: [],
  error: null,
};

const judgeGameProps: ApiMlbGamePropsResponse = {
  ...emptyGameProps,
  categories: [
    {
      stat: "home_runs",
      label: "Home Runs",
      players: [
        {
          player_name: "A. Judge",
          team_abbrev: "NYY",
          headshot_url: null,
          line: 0.5,
          over: { american: 270, book: "fanduel" },
          under: null,
        },
      ],
    },
  ],
};

const completeLineupGame: ApiMlbLineupGame = {
  away_abbrev: "wsh",
  home_abbrev: "phi",
  status: null,
  away: {
    pitcher: { name: "MacKenzie Gore", hand: "L", era: "3.40", record: "8-6" },
    batters: Array.from({ length: 9 }, (_, i) => ({
      order: i + 1,
      name: `Away Batter ${i + 1}`,
      position: "OF",
      hand: "L",
    })),
  },
  home: {
    pitcher: { name: "Zack Wheeler", hand: "R", era: "2.80", record: "10-4" },
    batters: Array.from({ length: 9 }, (_, i) => ({
      order: i + 1,
      name: `Home Batter ${i + 1}`,
      position: "OF",
      hand: "R",
    })),
  },
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("MlbPregameCenter", () => {
  beforeEach(() => {
    fetchMlbLineups.mockReset();
    fetchMlbGameProps.mockReset();
    fetchMlbGameProps.mockResolvedValue(emptyGameProps);
    useMlbLineupMatchup.mockClear();
    useMlbLineupMatchup.mockReturnValue({ data: null });
    useMlbOdds.mockClear();
    useMlbOdds.mockReturnValue({ data: null });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders header and projected lineups panel by default", () => {
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [],
    });
    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);
    expect(screen.getByTestId("mlb-pregame-center")).toBeInTheDocument();
    expect(
      screen.getByTestId("mlb-pregame-broadcast-header"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mlb-projected-lineups")).toBeInTheDocument();
    expect(useMlbOdds).toHaveBeenLastCalledWith({ enabled: true });
  });

  it("renders the matching odds board on Preview", () => {
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [],
    });
    useMlbOdds.mockReturnValue({
      data: {
        as_of: "2026-08-04T17:00:00Z",
        error: null,
        sportsbook: "pinnacle",
        games: [
          {
            away_abbrev: "WSH",
            home_abbrev: "PHI",
            game_date: mlbScheduledDetail.gameDate,
            sportsbook: "pinnacle",
            total: null,
            spread_line: null,
            spread_team_abbrev: null,
            board: {
              away: {
                moneyline: 113,
                spread: { line: 1.5, price: -182 },
                total: { side: "over", line: 7.5, price: -113 },
              },
              home: {
                moneyline: -115,
                spread: { line: -1.5, price: 174 },
                total: { side: "under", line: 7.5, price: 108 },
              },
            },
          },
        ],
      },
      isPending: false,
    });

    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);

    expect(screen.getByTestId("mlb-game-odds-board")).toBeInTheDocument();
    expect(screen.getByText("+113")).toBeInTheDocument();
  });

  it("shows a loading line instead of unavailable while the fetch is pending", () => {
    fetchMlbLineups.mockImplementation(() => new Promise(() => {}));
    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);
    expect(screen.getByText("Loading lineups…")).toBeInTheDocument();
    expect(screen.queryByText("Lineups unavailable")).not.toBeInTheDocument();
  });

  it("shows unavailable when no complete matching lineup exists for the game", async () => {
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [],
    });
    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);
    expect(
      await screen.findByText("Lineups unavailable"),
    ).toBeInTheDocument();
  });

  it("shows projected lineups when a case-insensitive abbrev match with both complete sides exists", async () => {
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [completeLineupGame],
    });
    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);
    expect(await screen.findByText("MacKenzie Gore")).toBeInTheDocument();
    expect(screen.getByText("Away Batter 1")).toBeInTheDocument();
    expect(fetchMlbLineups).toHaveBeenCalledWith(mlbScheduledDetail.gameDate);
  });

  it("loads matchup enrichment for a complete Preview lineup", async () => {
    const matchup: ApiMlbLineupMatchupResponse = {
      date: mlbScheduledDetail.gameDate,
      away_abbrev: "WSH",
      home_abbrev: "PHI",
      status: "expected",
      source: "rotowire+statsapi",
      fetched_at: "2026-08-04T17:00:00Z",
      away: {
        pitcher: {
          name: "MacKenzie Gore",
          hand: "L",
          mlbam_id: 669022,
          wins: 8,
          losses: 6,
          era: "3.40",
          innings_pitched: "121.2",
          strikeouts: 142,
          whip: "1.21",
          k_per_9: "10.52",
          bb_per_9: "3.10",
          strikeout_walk_ratio: "3.39",
        },
        batters: [],
      },
      home: {
        pitcher: {
          name: "Zack Wheeler",
          hand: "R",
          mlbam_id: 554430,
          wins: 10,
          losses: 4,
          era: "2.80",
          innings_pitched: "132.0",
          strikeouts: 151,
          whip: "0.98",
          k_per_9: "10.30",
          bb_per_9: "2.05",
          strikeout_walk_ratio: "5.03",
        },
        batters: [],
      },
    };
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [completeLineupGame],
    });
    useMlbLineupMatchup.mockReturnValue({ data: matchup });

    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);

    expect(await screen.findByText("1.21")).toBeInTheDocument();
    expect(useMlbLineupMatchup).toHaveBeenLastCalledWith({
      dateEt: mlbScheduledDetail.gameDate,
      away: mlbScheduledDetail.away.abbrev,
      home: mlbScheduledDetail.home.abbrev,
      enabled: true,
    });
  });

  it("prefers a later complete match when an earlier same-abbrev entry is incomplete", async () => {
    const incompleteGame: ApiMlbLineupGame = {
      ...completeLineupGame,
      home: { ...completeLineupGame.home, batters: [] },
    };
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [incompleteGame, completeLineupGame],
    });
    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);
    expect(await screen.findByText("MacKenzie Gore")).toBeInTheDocument();
    expect(screen.getByText("Away Batter 1")).toBeInTheDocument();
  });

  it("treats an incomplete lineup (missing batters) as unavailable", async () => {
    const incompleteGame: ApiMlbLineupGame = {
      ...completeLineupGame,
      home: { ...completeLineupGame.home, batters: [] },
    };
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [incompleteGame],
    });
    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);
    expect(
      await screen.findByText("Lineups unavailable"),
    ).toBeInTheDocument();
  });

  it("switches stub panels on tab click", async () => {
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [],
    });
    const user = userEvent.setup();
    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);
    await user.click(
      screen.getByRole("tab", { name: /washington nationals/i }),
    );
    expect(
      screen.getByText(/washington nationals preview coming soon/i),
    ).toBeInTheDocument();
    expect(useMlbOdds).toHaveBeenLastCalledWith({ enabled: false });
  });

  it("shows props grid under Preview lineups", async () => {
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [],
    });
    fetchMlbGameProps.mockResolvedValue(judgeGameProps);

    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);

    expect(screen.getByTestId("mlb-projected-lineups")).toBeInTheDocument();
    expect(await screen.findByTestId("mlb-game-props-grid")).toBeInTheDocument();
    expect(await screen.findByText("A. Judge")).toBeInTheDocument();
    expect(fetchMlbGameProps).toHaveBeenCalledWith({
      gamePk: mlbScheduledDetail.mlbGamePk,
      app: "prizepicks",
    });
  });

  it("switches to Props (PrizePicks) when a Preview prop row is clicked", async () => {
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [],
    });
    fetchMlbGameProps.mockResolvedValue(judgeGameProps);
    const user = userEvent.setup();

    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);

    await user.click(
      await screen.findByRole("button", { name: /A\. Judge/i }),
    );

    expect(screen.getByRole("tab", { name: "Props" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "PrizePicks" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("mlb-pregame-props-panel")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-props-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-projected-lineups")).not.toBeInTheDocument();
  });

  it("requests underdog props when Underdog sub-tab is selected under Props", async () => {
    fetchMlbLineups.mockResolvedValue({
      date: mlbScheduledDetail.gameDate,
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [],
    });
    fetchMlbGameProps.mockImplementation(
      async ({ app }: { gamePk: string; app: string }) => ({
        ...emptyGameProps,
        app,
        categories:
          app === "underdog"
            ? [
                {
                  stat: "hits",
                  label: "Hits",
                  players: [
                    {
                      player_name: "J. Soto",
                      team_abbrev: "NYY",
                      headshot_url: null,
                      line: 0.5,
                      over: { american: -110, book: "draftkings" },
                      under: null,
                    },
                  ],
                },
              ]
            : [],
      }),
    );
    const user = userEvent.setup();

    renderWithClient(<MlbPregameCenter detail={mlbScheduledDetail} />);

    await user.click(screen.getByRole("tab", { name: "Props" }));
    await user.click(screen.getByRole("tab", { name: "Underdog" }));

    await waitFor(() =>
      expect(fetchMlbGameProps).toHaveBeenCalledWith({
        gamePk: mlbScheduledDetail.mlbGamePk,
        app: "underdog",
      }),
    );
    expect(await screen.findByText("J. Soto")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Underdog" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
