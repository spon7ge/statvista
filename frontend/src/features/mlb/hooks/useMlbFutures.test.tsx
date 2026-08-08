import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMlbFutures } from "./useMlbFutures";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useMlbFutures", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads futures from API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        season: 2026,
        as_of: "2026-08-08T00:00:00Z",
        markets: [
          {
            id: "2761",
            name: "MLB  - World Series - Winner",
            display_name: "World Series Winner",
            provider: "DraftKings",
            entries: [],
          },
        ],
        error: null,
      }),
    });

    const { result } = renderHook(() => useMlbFutures(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.season).toBe(2026);
    expect(result.current.hasNeverLoaded).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/mlb/futures");
  });

  it("sets hasNeverLoaded on cold error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const { result } = renderHook(() => useMlbFutures(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hasNeverLoaded).toBe(true);
  });
});
