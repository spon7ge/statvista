import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useNbaScoreboard } from "./useNbaScoreboard";

vi.mock("@/shared/lib/matchupSlateDate", () => ({
  slateEtDate: () => "2026-07-29",
}));

const fetchMock = vi.fn();

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useNbaScoreboard", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("disables refetch interval when all games are final", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-07-29",
        fetched_at: "2026-07-29T12:00:00-04:00",
        games: [
          {
            id: "1",
            league: "nba",
            status: "final",
            status_label: "Final",
            start_time_et: "2026-07-29T23:00:00Z",
            away: { abbrev: "BOS", name: "Boston Celtics", score: 110 },
            home: { abbrev: "LAL", name: "Los Angeles Lakers", score: 105 },
          },
        ],
      }),
    });

    const { result } = renderHook(() => useNbaScoreboard(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.shouldPoll).toBe(false);
  });

  it("enables polling when any game is live", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-07-29",
        fetched_at: "2026-07-29T12:00:00-04:00",
        games: [
          {
            id: "1",
            league: "nba",
            status: "live",
            status_label: "Q3 7:13",
            start_time_et: "2026-07-29T23:00:00Z",
            away: { abbrev: "BOS", name: "Boston Celtics", score: 72 },
            home: { abbrev: "LAL", name: "Los Angeles Lakers", score: 68 },
          },
        ],
      }),
    });

    const { result } = renderHook(() => useNbaScoreboard(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.shouldPoll).toBe(true);
  });

  it("flags hasNeverLoaded when the first request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const { result } = renderHook(() => useNbaScoreboard(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hasNeverLoaded).toBe(true);
    expect(result.current.liveGames).toEqual([]);
  });

  it("clears hasNeverLoaded once data has loaded successfully", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-07-29",
        fetched_at: "2026-07-29T12:00:00-04:00",
        games: [],
      }),
    });

    const { result } = renderHook(() => useNbaScoreboard(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNeverLoaded).toBe(false);
  });

  it("fetches dated scoreboard without polling for non-today dates", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-07-28",
        fetched_at: "2026-07-28T12:00:00-04:00",
        games: [
          {
            id: "1",
            league: "nba",
            status: "live",
            status_label: "Q3 7:13",
            start_time_et: "2026-07-28T23:00:00Z",
            away: { abbrev: "BOS", name: "Boston Celtics", score: 72 },
            home: { abbrev: "LAL", name: "Los Angeles Lakers", score: 68 },
          },
        ],
      }),
    });

    const { result } = renderHook(() => useNbaScoreboard("2026-07-28"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/nba/scoreboard?date=2026-07-28"),
      expect.any(Object),
    );
    expect(result.current.shouldPoll).toBe(false);
  });

  it("uses today endpoint when dateEt matches slate today", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-07-29",
        fetched_at: "2026-07-29T12:00:00-04:00",
        games: [],
      }),
    });

    const { result } = renderHook(() => useNbaScoreboard("2026-07-29"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/nba/scoreboard/today"),
      expect.any(Object),
    );
  });
});
