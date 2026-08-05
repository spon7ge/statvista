import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMlbLineupMatchup } from "./useMlbLineupMatchup";

vi.mock("@/lib/api", () => ({
  fetchMlbLineupMatchup: vi.fn(async () => ({
    date: "2026-08-04",
    away_abbrev: "WSH",
    home_abbrev: "SF",
    status: "expected",
    away: null,
    home: null,
    source: "rotowire+statsapi",
    fetched_at: "2026-08-04T17:00:00+00:00",
  })),
}));

describe("useMlbLineupMatchup", () => {
  it("fetches when enabled", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useMlbLineupMatchup({
          dateEt: "2026-08-04",
          away: "WSH",
          home: "SF",
          enabled: true,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.away_abbrev).toBe("WSH");
  });
});
