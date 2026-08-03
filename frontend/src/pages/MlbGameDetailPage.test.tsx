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
    linescore: null,
    situation: null,
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
    expect(screen.getByText(/Data: MLB Stats API · ESPN/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Top 3rd/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Fenway Park/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows Not live yet for scheduled MLB games", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mlbDetail("scheduled"),
    });
    renderPage();
    expect(await screen.findByText("Not live yet")).toBeInTheDocument();
    expect(screen.getByText(/Boston Red Sox/i)).toBeInTheDocument();
    expect(screen.getByText(/Los Angeles Dodgers/i)).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-live-center")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/",
    );
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
      "/",
    );
  });

  it("shows Unable to load game when the MLB game request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    renderPage();
    expect(await screen.findByText("Unable to load game")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
