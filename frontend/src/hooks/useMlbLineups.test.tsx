import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMlbLineups } from "./useMlbLineups";

const fetchMlbLineups = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchMlbLineups: (...args: unknown[]) => fetchMlbLineups(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useMlbLineups", () => {
  beforeEach(() => {
    fetchMlbLineups.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when dateEt is falsy", () => {
    const { result } = renderHook(() => useMlbLineups(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMlbLineups).not.toHaveBeenCalled();
  });

  it("fetches lineups for the given date", async () => {
    fetchMlbLineups.mockResolvedValue({
      date: "2026-08-04",
      fetched_at: "2026-08-04T10:00:00-04:00",
      source: "rotowire",
      games: [],
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useMlbLineups("2026-08-04"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMlbLineups).toHaveBeenCalledWith("2026-08-04");
    expect(
      client.getQueryCache().findAll({ queryKey: ["mlb", "lineups", "2026-08-04"] }),
    ).toHaveLength(1);
  });

  it("flags hasNeverLoaded when the first request fails", async () => {
    fetchMlbLineups.mockRejectedValue(new Error("MLB lineups failed"));

    const { result } = renderHook(() => useMlbLineups("2026-08-04"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hasNeverLoaded).toBe(true);
  });
});
