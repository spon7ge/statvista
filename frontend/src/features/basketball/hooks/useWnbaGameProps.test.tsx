import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useWnbaGameProps } from "./useWnbaGameProps";

const fetchWnbaGameProps = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchWnbaGameProps: (...args: unknown[]) => fetchWnbaGameProps(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useWnbaGameProps", () => {
  beforeEach(() => {
    fetchWnbaGameProps.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when espnEventId is empty or disabled", () => {
    const { result: emptyId } = renderHook(
      () => useWnbaGameProps({ espnEventId: "", app: "prizepicks" }),
      { wrapper },
    );
    expect(emptyId.current.fetchStatus).toBe("idle");
    expect(fetchWnbaGameProps).not.toHaveBeenCalled();

    const { result: disabled } = renderHook(
      () =>
        useWnbaGameProps({
          espnEventId: "401770001",
          app: "prizepicks",
          enabled: false,
        }),
      { wrapper },
    );
    expect(disabled.current.fetchStatus).toBe("idle");
    expect(fetchWnbaGameProps).not.toHaveBeenCalled();
  });

  it("fetches game props with query key including espnEventId and app", async () => {
    fetchWnbaGameProps.mockResolvedValue({
      as_of: "2026-08-10T00:00:00Z",
      app: "underdog",
      espn_event_id: "401770001",
      away_abbrev: "LVA",
      home_abbrev: "NYL",
      categories: [],
      error: null,
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => useWnbaGameProps({ espnEventId: "401770001", app: "underdog" }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchWnbaGameProps).toHaveBeenCalledWith({
      espnEventId: "401770001",
      app: "underdog",
    });
    expect(
      client.getQueryCache().findAll({
        queryKey: ["wnba", "props", "game", "401770001", "underdog"],
      }),
    ).toHaveLength(1);
  });
});
