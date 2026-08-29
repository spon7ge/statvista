import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MlbGameDetailPage } from "./MlbGameDetailPage";

const fetchMock = vi.fn();

function mlbDetail(status: "live" | "final" | "scheduled", sources = ["statsapi"]) {
  return {
    mlb_game_pk: "824971",
    league: "mlb",
    status,
    status_label:
      status === "live" ? "Top 3rd" : status === "final" ? "Final" : "7:10 PM ET",
    venue: "Fenway Park",
    away: {
      id: "111",
      abbrev: "BOS",
      name: "Boston Red Sox",
      score: status === "scheduled" ? null : 2,
      color: "#BD3039",
      logo_url: null,
    },
    home: {
      id: "119",
      abbrev: "LAD",
      name: "Los Angeles Dodgers",
      score: status === "scheduled" ? null : 1,
      color: "#005A9C",
      logo_url: null,
    },
    linescore:
      status === "scheduled"
        ? null
        : {
            current_inning: 3,
            inning_half: "top",
            innings: [
              { num: 1, away_runs: 0, home_runs: 1 },
              { num: 2, away_runs: 1, home_runs: 0 },
              { num: 3, away_runs: 1, home_runs: 0 },
            ],
            away: { runs: 2, hits: 3, errors: 0 },
            home: { runs: 1, hits: 2, errors: 1 },
          },
    situation:
      status === "scheduled"
        ? null
        : {
            balls: 2,
            strikes: 1,
            outs: 1,
            runners: { first: true, second: false, third: false },
            pitches: [
              {
                number: 1,
                type: "FF",
                mph: 95.2,
                result: "Ball",
                is_strike: false,
                zone_x: 0.1,
                zone_y: 0.2,
              },
            ],
            at_bat: { name: "Mookie Betts", hand: "R", summary: ".280 AVG" },
            on_deck: { name: "Freddie Freeman", hand: "L", summary: null },
            pitching: { name: "Chris Sale", hand: "L", summary: "6 K" },
            latest_play_text: "Ball",
          },
    plays: [],
    scoring_plays: [],
    box_score: null,
    win_probability: null,
    hit_chart: [],
    sources,
    fetched_at: "2026-08-02T00:00:00Z",
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/mlb/games/824971"]}>
        <Routes>
          <Route path="/mlb/games/:gamePk" element={<MlbGameDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MlbGameDetailPage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows live center sections and attribution for live MLB games", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mlbDetail("live", ["statsapi", "espn"]),
    });
    renderPage();
    expect(await screen.findByTestId("mlb-live-center")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-broadcast-header")).toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: /live game details/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mlb-live-matchup")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-pitch-zone")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-final-play-feed")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-final-linescore-card")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-flow")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-chart")).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-live-viz-row")).not.toBeInTheDocument();
    expect(screen.getByText(/Data: MLB Stats API · ESPN/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Top 3rd/i)).toHaveLength(1);
    expect(screen.getAllByText(/Fenway Park/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    expect(
      screen.getByRole("link", { name: /back/i }).closest(".max-w-6xl"),
    ).toHaveClass("md:pr-[150px]");
  });

  it("shows pregame center for scheduled MLB games", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mlbDetail("scheduled"),
        game_date_label: "Today",
        away: { ...mlbDetail("scheduled").away, record: "55-59", last_10: "0-5" },
        home: { ...mlbDetail("scheduled").home, record: "60-53", last_10: "3-2" },
      }),
    });
    renderPage();
    expect(await screen.findByTestId("mlb-pregame-center")).toBeInTheDocument();
    expect(screen.queryByText("Not live yet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-live-center")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    expect(
      screen.getByRole("link", { name: /back/i }).closest(".max-w-6xl"),
    ).toHaveClass("md:pr-[150px]");
  });

  it("shows final center for final MLB games", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mlbDetail("final", ["statsapi", "espn"]),
    });
    renderPage();
    expect(await screen.findByTestId("mlb-final-center")).toBeInTheDocument();
    expect(
      screen.queryByText("Final — live center for completed games coming soon"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-live-center")).not.toBeInTheDocument();
    expect(screen.getByText(/Data: MLB Stats API · ESPN/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
  });

  it("shows Unable to load game when the MLB game request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    renderPage();
    expect(await screen.findByText("Unable to load game")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
  });
});
