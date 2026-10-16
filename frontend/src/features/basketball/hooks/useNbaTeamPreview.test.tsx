import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNbaTeamPreview } from "./useNbaTeamPreview";

const fetchNbaTeamPreview = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchNbaTeamPreview: (...args: unknown[]) => fetchNbaTeamPreview(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useNbaTeamPreview", () => {
  beforeEach(() => {
    fetchNbaTeamPreview.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when the event id is empty or the query is disabled", () => {
    const { result: emptyId } = renderHook(
      () => useNbaTeamPreview({ espnEventId: "", side: "away" }),
      { wrapper },
    );
    expect(emptyId.current.fetchStatus).toBe("idle");

    const { result: disabled } = renderHook(
      () =>
        useNbaTeamPreview({
          espnEventId: "401810001",
          side: "home",
          enabled: false,
        }),
      { wrapper },
    );
    expect(disabled.current.fetchStatus).toBe("idle");
    expect(fetchNbaTeamPreview).not.toHaveBeenCalled();
  });

  it("fetches the requested NBA team preview", async () => {
    fetchNbaTeamPreview.mockResolvedValue({
      side: "away",
      team: {
        id: "13",
        abbrev: "LAL",
        name: "Los Angeles Lakers",
        logo_url: null,
      },
      leaders: [],
      roster: [],
    });

    const { result } = renderHook(
      () =>
        useNbaTeamPreview({
          espnEventId: "401810001",
          side: "away",
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchNbaTeamPreview).toHaveBeenCalledWith({
      espnEventId: "401810001",
      side: "away",
    });
  });
});
