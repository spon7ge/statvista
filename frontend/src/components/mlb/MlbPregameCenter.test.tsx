import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MlbPregameCenter } from "./MlbPregameCenter";
import { mlbScheduledDetail } from "./testFixtures";
import type { ApiMlbLineupGame } from "@/lib/api";

const fetchMlbLineups = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchMlbLineups: (...args: unknown[]) => fetchMlbLineups(...args),
}));

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
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders header and preview stub by default", () => {
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
  });
});
