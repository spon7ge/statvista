import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWnbaLegs } from "./useWnbaLegs";

const fetchWnbaLegs = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchWnbaLegs: (...args: unknown[]) => fetchWnbaLegs(...args),
}));

describe("useWnbaLegs", () => {
  beforeEach(() => {
    fetchWnbaLegs.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches legs with query key including app format legs", async () => {
    fetchWnbaLegs.mockResolvedValue({
      generated_at: "2026-08-30T20:00:00Z",
      slate: "WNBA 2026-08-30",
      app: "prizepicks",
      format: "power",
      entries: [],
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => useWnbaLegs({ app: "prizepicks", format: "power", legs: 4 }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchWnbaLegs).toHaveBeenCalledWith({
      app: "prizepicks",
      format: "power",
      legs: 4,
    });
    expect(
      client.getQueryCache().findAll({
        queryKey: ["wnba", "legs", "prizepicks", "power", 4],
      }),
    ).toHaveLength(1);
    const query = client.getQueryCache().find({
      queryKey: ["wnba", "legs", "prizepicks", "power", 4],
    });
    expect(query?.options.staleTime).toBe(5 * 60 * 1000);
  });
});
