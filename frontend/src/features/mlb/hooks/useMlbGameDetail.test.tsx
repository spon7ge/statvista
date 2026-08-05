import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMlbGameDetail } from "./useMlbGameDetail";

const fetchMock = vi.fn();

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mlbDetail(status: "live" | "final" | "scheduled") {
  return {
    mlb_game_pk: "824971",
    league: "mlb",
    status,
    status_label: status === "live" ? "Top 3rd" : status === "final" ? "Final" : "7:10 PM ET",
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
    sources: ["statsapi"],
    fetched_at: "2026-08-02T00:00:00Z",
  };
}

describe("useMlbGameDetail", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enables polling for live MLB games", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mlbDetail("live"),
    });
    const { result } = renderHook(() => useMlbGameDetail("824971"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.shouldPoll).toBe(true);
  });

  it("disables polling for final MLB games", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mlbDetail("final"),
    });
    const { result } = renderHook(() => useMlbGameDetail("824971"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.shouldPoll).toBe(false);
  });

  it("flags hasNeverLoaded on first failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const { result } = renderHook(() => useMlbGameDetail("824971"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hasNeverLoaded).toBe(true);
  });
});
