import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMlbStandings } from "./useMlbStandings";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useMlbStandings", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads standings from API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        season: 2026,
        leagues: [
          {
            key: "al",
            label: "American League",
            divisions: [{ key: "al-east", label: "AL East", teams: [] }],
          },
          {
            key: "nl",
            label: "National League",
            divisions: [{ key: "nl-west", label: "NL West", teams: [] }],
          },
        ],
      }),
    });

    const { result } = renderHook(() => useMlbStandings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.season).toBe(2026);
    expect(result.current.hasNeverLoaded).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/mlb/standings");
  });

  it("sets hasNeverLoaded on cold error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const { result } = renderHook(() => useMlbStandings(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hasNeverLoaded).toBe(true);
  });
});
