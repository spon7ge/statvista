import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useWnbaTeamPreview } from "./useWnbaTeamPreview";

const fetchWnbaTeamPreview = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchWnbaTeamPreview: (...args: unknown[]) => fetchWnbaTeamPreview(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useWnbaTeamPreview", () => {
  beforeEach(() => {
    fetchWnbaTeamPreview.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when espnEventId is empty or disabled", () => {
    const { result: emptyId } = renderHook(
      () => useWnbaTeamPreview({ espnEventId: "", side: "away" }),
      { wrapper },
    );
    expect(emptyId.current.fetchStatus).toBe("idle");
    expect(fetchWnbaTeamPreview).not.toHaveBeenCalled();

    const { result: disabled } = renderHook(
      () =>
        useWnbaTeamPreview({
          espnEventId: "401734891",
          side: "home",
          enabled: false,
        }),
      { wrapper },
    );
    expect(disabled.current.fetchStatus).toBe("idle");
    expect(fetchWnbaTeamPreview).not.toHaveBeenCalled();
  });

  it("fetches team preview with query key including espnEventId and side", async () => {
    fetchWnbaTeamPreview.mockResolvedValue({
      side: "away",
      team: {
        id: "16",
        abbrev: "MIN",
        name: "Minnesota Lynx",
        logo_url: null,
      },
      leaders: [],
      roster: [],
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => useWnbaTeamPreview({ espnEventId: "401734891", side: "away" }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchWnbaTeamPreview).toHaveBeenCalledWith({
      espnEventId: "401734891",
      side: "away",
    });
    expect(
      client.getQueryCache().findAll({
        queryKey: ["wnba", "team-preview", "401734891", "away"],
      }),
    ).toHaveLength(1);
  });
});
