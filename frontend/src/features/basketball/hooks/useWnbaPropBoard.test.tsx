import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  wnbaPropBoardQueryKey,
  WNBA_PROP_BOARD_STALE_MS,
  prefetchWnbaPropBoard,
  useWnbaPropBoard,
} from "./useWnbaPropBoard";

const fetchWnbaPropBoard = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchWnbaPropBoard: (...args: unknown[]) => fetchWnbaPropBoard(...args),
}));

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useWnbaPropBoard", () => {
  beforeEach(() => {
    fetchWnbaPropBoard.mockReset();
    fetchWnbaPropBoard.mockResolvedValue({
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
    const { result } = renderHook(() => useWnbaPropBoard(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = client.getQueryCache().find({
      queryKey: wnbaPropBoardQueryKey("prizepicks"),
    });
    expect(query?.options.staleTime).toBe(WNBA_PROP_BOARD_STALE_MS);
    expect(query?.options.refetchInterval).toBe(WNBA_PROP_BOARD_STALE_MS);
    expect(query?.options.refetchOnWindowFocus).toBe(false);
  });

  it("calls fetchWnbaPropBoard with prizepicks when no book is passed", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useWnbaPropBoard(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchWnbaPropBoard).toHaveBeenCalledWith("prizepicks");
    expect(
      client.getQueryData(wnbaPropBoardQueryKey("prizepicks")),
    ).toEqual({
      as_of: "2026-08-28T00:00:00Z",
      warnings: [],
      rows: [],
    });
  });

  it("calls fetchWnbaPropBoard with the requested book and stores that key", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useWnbaPropBoard("draftkings"), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchWnbaPropBoard).toHaveBeenCalledWith("draftkings");
    expect(
      client.getQueryData(wnbaPropBoardQueryKey("draftkings")),
    ).toEqual({
      as_of: "2026-08-28T00:00:00Z",
      warnings: [],
      rows: [],
    });
    expect(
      client.getQueryData(wnbaPropBoardQueryKey("prizepicks")),
    ).toBeUndefined();
  });

  it("prefetchWnbaPropBoard fills the prizepicks query key", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await prefetchWnbaPropBoard(client);
    expect(fetchWnbaPropBoard).toHaveBeenCalledOnce();
    expect(fetchWnbaPropBoard).toHaveBeenCalledWith("prizepicks");
    expect(
      client.getQueryData(wnbaPropBoardQueryKey("prizepicks")),
    ).toEqual({
      as_of: "2026-08-28T00:00:00Z",
      warnings: [],
      rows: [],
    });
  });
});
