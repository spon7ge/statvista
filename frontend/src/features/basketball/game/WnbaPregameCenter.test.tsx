import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ApiWnbaOddsResponse } from "@/shared/lib/api";
import { buildScheduledDetail } from "../lib/testFixtures";
import type { GameDetailGameLeaders, GameDetailSeasonTeamStatLine } from "../lib/types";
import { WnbaPregameCenter } from "./WnbaPregameCenter";

const useWnbaOdds = vi.fn(() => ({
  data: null as ApiWnbaOddsResponse | null,
  isPending: false,
}));

vi.mock("@/features/basketball/hooks/useWnbaOdds", () => ({
  useWnbaOdds: (...args: unknown[]) => useWnbaOdds(...args),
}));

const nullRanks = {
  ptsRank: null,
  fgPctRank: null,
  fg3PctRank: null,
  ftPctRank: null,
  rebRank: null,
  astRank: null,
  stlRank: null,
  blkRank: null,
  toRank: null,
} as const;

const awayLine: GameDetailSeasonTeamStatLine = {
  pts: 92,
  fgPct: ".460",
  fg3Pct: ".350",
  ftPct: ".820",
  reb: 34,
  ast: 22,
  stl: 8,
  blk: 4,
  to: 13,
  ...nullRanks,
};

const homeLine: GameDetailSeasonTeamStatLine = {
  pts: 88,
  fgPct: ".440",
  fg3Pct: ".330",
  ftPct: ".790",
  reb: 36,
  ast: 20,
  stl: 7,
  blk: 5,
  to: 14,
  ...nullRanks,
};

const gameLeaders: GameDetailGameLeaders = {
  leaders: [
    {
      key: "ppg",
      label: "PPG",
      rank: 1,
      value: "26.6",
      playerId: "p1",
      lastName: "Collier",
      teamAbbrev: "MIN",
      side: "away",
      headshotUrl: null,
    },
    {
      key: "rpg",
      label: "RPG",
      rank: 2,
      value: "9.1",
      playerId: "p2",
      lastName: "Nurse",
      teamAbbrev: "TOR",
      side: "home",
      headshotUrl: null,
    },
    {
      key: "apg",
      label: "APG",
      rank: 3,
      value: "6.2",
      playerId: "p3",
      lastName: "Williams",
      teamAbbrev: "MIN",
      side: "away",
      headshotUrl: null,
    },
  ],
};

const scheduledWithPreview = buildScheduledDetail({
  matchupPrediction: {
    awayWinPct: 67,
    homeWinPct: 33,
    sourceLabel: "ESPN game projection",
  },
  projectedStarters: {
    note: "from each team's last game",
    away: [
      { jersey: "1", name: "Natasha Howard", position: "F", gtd: false },
    ],
    home: [
      { jersey: "10", name: "Maria Conde", position: "F", gtd: false },
    ],
  },
  seasonLeaders: {
    away: [
      { stat: "points", label: "Points", name: "Player A", value: "20.1" },
    ],
    home: [
      { stat: "points", label: "Points", name: "Player B", value: "18.5" },
    ],
  },
  injuries: {
    away: [],
    home: [],
  },
  seasonTeamStats: { away: awayLine, home: homeLine },
  gameLeaders,
});

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function follows(earlier: HTMLElement, later: HTMLElement): boolean {
  return Boolean(
    earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe("WnbaPregameCenter", () => {
  beforeEach(() => {
    useWnbaOdds.mockReset();
    useWnbaOdds.mockReturnValue({ data: null, isPending: false });
  });

  it("uses pregame broadcast header with Preview tab selected by default", () => {
    renderWithClient(<WnbaPregameCenter detail={scheduledWithPreview} />);

    expect(screen.getByTestId("wnba-pregame-center")).toBeInTheDocument();
    expect(
      screen.getByTestId("wnba-pregame-broadcast-header"),
    ).toBeInTheDocument();
    expect(screen.getByText(scheduledWithPreview.statusLabel)).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Preview" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: /summary/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^box$/i })).not.toBeInTheDocument();
  });

  it("renders two-column preview with approved section order", () => {
    renderWithClient(<WnbaPregameCenter detail={scheduledWithPreview} />);

    const grid = screen.getByTestId("wnba-preview-lineups-odds-grid");
    expect(grid).toHaveClass("lg:grid-cols-2");

    const left = screen.getByTestId("wnba-preview-left-column");
    const right = screen.getByTestId("wnba-preview-right-column");
    expect(grid).toContainElement(left);
    expect(grid).toContainElement(right);

    const starters = within(left).getByRole("heading", {
      name: /Projected starters/i,
    });
    const gameInfo = within(left).getByRole("heading", { name: "Game Info" });
    const prediction = within(left).getByRole("heading", {
      name: /Matchup prediction/i,
    });
    const leaders = within(left).getByRole("heading", { name: "Game Leaders" });

    expect(follows(starters, gameInfo)).toBe(true);
    expect(follows(gameInfo, prediction)).toBe(true);
    expect(follows(prediction, leaders)).toBe(true);

    const odds = within(right).getByRole("heading", { name: "Odds" });
    const teamStats = within(right).getByRole("heading", { name: "Team Stats" });
    const injuries = within(right).getByRole("heading", {
      name: /Injury report/i,
    });

    expect(follows(odds, teamStats)).toBe(true);
    expect(follows(teamStats, injuries)).toBe(true);

    expect(screen.queryByText(/Season leaders/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shot chart/i)).not.toBeInTheDocument();
  });

  it("shows placeholder panels for Away, Home, and Props tabs", async () => {
    const user = userEvent.setup();
    renderWithClient(<WnbaPregameCenter detail={scheduledWithPreview} />);

    await user.click(
      screen.getByRole("tab", { name: scheduledWithPreview.away.name }),
    );
    expect(screen.getByTestId("wnba-pregame-away-placeholder")).toBeInTheDocument();
    expect(
      screen.queryByTestId("wnba-preview-left-column"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("tab", { name: scheduledWithPreview.home.name }),
    );
    expect(screen.getByTestId("wnba-pregame-home-placeholder")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Props" }));
    expect(
      screen.getByTestId("wnba-pregame-props-placeholder"),
    ).toBeInTheDocument();
  });
});
