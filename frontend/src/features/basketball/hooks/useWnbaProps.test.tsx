import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWnbaProps } from "./useWnbaProps";

const fetchWnbaProps = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchWnbaProps: (...args: unknown[]) => fetchWnbaProps(...args),
}));

describe("useWnbaProps", () => {
  beforeEach(() => {
    fetchWnbaProps.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches props with query key including app format legs", async () => {
    fetchWnbaProps.mockResolvedValue({
      as_of: "2026-08-10T00:00:00Z",
      app: "prizepicks",
      format: "power",
      legs: 4,
      breakeven_pct: 54.3,
      props: [],
      error: null,
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => useWnbaProps({ app: "prizepicks", format: "power", legs: 4 }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchWnbaProps).toHaveBeenCalledWith({
      app: "prizepicks",
      format: "power",
      legs: 4,
    });
    expect(
      client.getQueryCache().findAll({
        queryKey: ["wnba", "props", "prizepicks", "power", 4],
      }),
    ).toHaveLength(1);
  });
});
