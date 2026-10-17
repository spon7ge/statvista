import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NBA_PROP_BOARD_STALE_MS,
  nbaPropBoardQueryKey,
  prefetchNbaPropBoard,
  useNbaPropBoard,
} from "./useNbaPropBoard";

const fetchNbaPropBoard = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchNbaPropBoard: (...args: unknown[]) => fetchNbaPropBoard(...args),
}));

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useNbaPropBoard", () => {
  beforeEach(() => {
    fetchNbaPropBoard.mockReset();
    fetchNbaPropBoard.mockResolvedValue({
      as_of: "2026-10-16T00:00:00Z",
      warnings: [],
      rows: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses the requested book with a 15-minute stale time", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useNbaPropBoard("draftkings"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchNbaPropBoard).toHaveBeenCalledWith("draftkings");
    const query = client.getQueryCache().find({
      queryKey: nbaPropBoardQueryKey("draftkings"),
    });
    expect(query?.options.staleTime).toBe(NBA_PROP_BOARD_STALE_MS);
    expect(query?.options.refetchInterval).toBe(NBA_PROP_BOARD_STALE_MS);
    expect(query?.options.refetchOnWindowFocus).toBe(false);
  });

  it("defaults to the prizepicks query key", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useNbaPropBoard(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchNbaPropBoard).toHaveBeenCalledWith("prizepicks");
    expect(
      client.getQueryData(nbaPropBoardQueryKey("prizepicks")),
    ).toEqual({
      as_of: "2026-10-16T00:00:00Z",
      warnings: [],
      rows: [],
    });
  });

  it("prefetches the default PrizePicks board", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await prefetchNbaPropBoard(client);

    expect(fetchNbaPropBoard).toHaveBeenCalledWith("prizepicks");
    expect(
      client.getQueryData(nbaPropBoardQueryKey("prizepicks")),
    ).toBeDefined();
  });
});
