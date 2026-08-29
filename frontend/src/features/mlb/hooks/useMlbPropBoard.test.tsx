import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  MLB_PROP_BOARD_QUERY_KEY,
  MLB_PROP_BOARD_STALE_MS,
  prefetchMlbPropBoard,
  useMlbPropBoard,
} from "./useMlbPropBoard";

const fetchMlbPropBoard = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchMlbPropBoard: (...args: unknown[]) => fetchMlbPropBoard(...args),
}));

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useMlbPropBoard", () => {
  beforeEach(() => {
    fetchMlbPropBoard.mockReset();
    fetchMlbPropBoard.mockResolvedValue({
      as_of: "2026-08-28T00:00:00Z",
      warnings: [],
      rows: [],
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses a 15-minute staleTime and does not refetch on focus", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 10_000 } },
    });
    const { result } = renderHook(() => useMlbPropBoard(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = client.getQueryCache().find({
      queryKey: MLB_PROP_BOARD_QUERY_KEY,
    });
    expect(query?.options.staleTime).toBe(MLB_PROP_BOARD_STALE_MS);
    expect(query?.options.refetchInterval).toBe(MLB_PROP_BOARD_STALE_MS);
    expect(query?.options.refetchOnWindowFocus).toBe(false);
  });

  it("prefetchMlbPropBoard fills the same query key", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await prefetchMlbPropBoard(client);
    expect(fetchMlbPropBoard).toHaveBeenCalledOnce();
    expect(
      client.getQueryData(MLB_PROP_BOARD_QUERY_KEY),
    ).toEqual({
      as_of: "2026-08-28T00:00:00Z",
      warnings: [],
      rows: [],
    });
  });
});
