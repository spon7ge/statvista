import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMlbTeamPreview } from "./useMlbTeamPreview";

const fetchMlbTeamPreview = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchMlbTeamPreview: (...args: unknown[]) => fetchMlbTeamPreview(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useMlbTeamPreview", () => {
  beforeEach(() => {
    fetchMlbTeamPreview.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when gamePk is empty or disabled", () => {
    const { result: emptyPk } = renderHook(
      () => useMlbTeamPreview({ gamePk: "", side: "away" }),
      { wrapper },
    );
    expect(emptyPk.current.fetchStatus).toBe("idle");
    expect(fetchMlbTeamPreview).not.toHaveBeenCalled();

    const { result: disabled } = renderHook(
      () =>
        useMlbTeamPreview({
          gamePk: "746123",
          side: "home",
          enabled: false,
        }),
      { wrapper },
    );
    expect(disabled.current.fetchStatus).toBe("idle");
    expect(fetchMlbTeamPreview).not.toHaveBeenCalled();
  });

  it("fetches team preview with query key including gamePk and side", async () => {
    fetchMlbTeamPreview.mockResolvedValue({
      side: "away",
      team: {
        id: "147",
        abbrev: "NYY",
        name: "New York Yankees",
        logo_url: null,
      },
      batting_leaders: [],
      pitching_leaders: [],
      batting_roster: [],
      pitching_roster: [],
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => useMlbTeamPreview({ gamePk: "746123", side: "away" }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMlbTeamPreview).toHaveBeenCalledWith({
      gamePk: "746123",
      side: "away",
    });
    expect(
      client.getQueryCache().findAll({
        queryKey: ["mlb", "team-preview", "746123", "away"],
      }),
    ).toHaveLength(1);
  });
});
