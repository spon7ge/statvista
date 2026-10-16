import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NbaGameDetailPage } from "./NbaGameDetailPage";

function renderGameDetail(espnEventId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/nba/games/${espnEventId}`]}>
        <Routes>
          <Route
            path="/nba/games/:espnEventId"
            element={<NbaGameDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function nbaGameDetail(status: "scheduled" | "live" | "halftime" | "final") {
  return {
    espn_event_id: "401810001",
    league: "nba",
    status,
    status_label:
      status === "scheduled"
        ? "7:00 PM ET"
        : status === "final"
          ? "Final"
          : "4:13 - 1st",
    venue: "Crypto.com Arena",
    away: {
      id: "13",
      abbrev: "LAL",
      name: "Los Angeles Lakers",
      score: status === "scheduled" ? null : 10,
      color: "#552583",
      logo_url: null,
    },
    home: {
      id: "9",
      abbrev: "GSW",
      name: "Golden State Warriors",
      score: status === "scheduled" ? null : 9,
      color: "#1D428A",
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
  };
}

describe("NbaGameDetailPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes scheduled NBA games to NbaPregameCenter", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => nbaGameDetail("scheduled"),
    });

    renderGameDetail("401810001");

    expect(await screen.findByTestId("nba-pregame-center")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/nba/matchups",
    );
  });

  it("routes live NBA games to NbaLiveCenter", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => nbaGameDetail("live"),
    });

    renderGameDetail("401810001");

    expect(await screen.findByTestId("nba-live-center")).toBeInTheDocument();
  });

  it("routes halftime NBA games to NbaLiveCenter", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => nbaGameDetail("halftime"),
    });

    renderGameDetail("401810001");

    expect(await screen.findByTestId("nba-live-center")).toBeInTheDocument();
  });

  it("routes final NBA games to NbaFinalCenter", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => nbaGameDetail("final"),
    });

    renderGameDetail("401810001");

    expect(await screen.findByTestId("nba-final-center")).toBeInTheDocument();
  });
});
