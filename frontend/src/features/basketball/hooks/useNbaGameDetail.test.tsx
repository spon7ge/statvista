import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNbaGameDetail } from "./useNbaGameDetail";

const fetchNbaGameDetail = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchNbaGameDetail: (...args: unknown[]) => fetchNbaGameDetail(...args),
}));

function createWrapper(client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})) {
  return function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useNbaGameDetail", () => {
  beforeEach(() => {
    fetchNbaGameDetail.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses the NBA game query key and enables polling when live", async () => {
    fetchNbaGameDetail.mockResolvedValue({ status: "live" });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useNbaGameDetail("401810001"), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.shouldPoll).toBe(true);
    expect(
      client.getQueryCache().findAll({
        queryKey: ["nba", "game", "401810001"],
      }),
    ).toHaveLength(1);
  });

  it("disables polling when final", async () => {
    fetchNbaGameDetail.mockResolvedValue({ status: "final" });

    const { result } = renderHook(() => useNbaGameDetail("401810001"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.shouldPoll).toBe(false);
  });

  it("does not fetch without an event id", () => {
    const { result } = renderHook(() => useNbaGameDetail(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchNbaGameDetail).not.toHaveBeenCalled();
  });

  it("flags a first-load failure", async () => {
    fetchNbaGameDetail.mockRejectedValue(new Error("unavailable"));

    const { result } = renderHook(() => useNbaGameDetail("401810001"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hasNeverLoaded).toBe(true);
  });
});
