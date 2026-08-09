import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMlbGameProps } from "./useMlbGameProps";

const fetchMlbGameProps = vi.fn();

vi.mock("@/shared/lib/api", () => ({
  fetchMlbGameProps: (...args: unknown[]) => fetchMlbGameProps(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useMlbGameProps", () => {
  beforeEach(() => {
    fetchMlbGameProps.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when gamePk is empty or disabled", () => {
    const { result: emptyPk } = renderHook(
      () => useMlbGameProps({ gamePk: "", app: "prizepicks" }),
      { wrapper },
    );
    expect(emptyPk.current.fetchStatus).toBe("idle");
    expect(fetchMlbGameProps).not.toHaveBeenCalled();

    const { result: disabled } = renderHook(
      () =>
        useMlbGameProps({
          gamePk: "746123",
          app: "prizepicks",
          enabled: false,
        }),
      { wrapper },
    );
    expect(disabled.current.fetchStatus).toBe("idle");
    expect(fetchMlbGameProps).not.toHaveBeenCalled();
  });

  it("fetches game props with query key including gamePk and app", async () => {
    fetchMlbGameProps.mockResolvedValue({
      as_of: "2026-08-09T00:00:00Z",
      app: "underdog",
      game_pk: "746123",
      away_abbrev: "NYY",
      home_abbrev: "BOS",
      categories: [],
      error: null,
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => useMlbGameProps({ gamePk: "746123", app: "underdog" }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMlbGameProps).toHaveBeenCalledWith({
      gamePk: "746123",
      app: "underdog",
    });
    expect(
      client.getQueryCache().findAll({
        queryKey: ["mlb", "props", "game", "746123", "underdog"],
      }),
    ).toHaveLength(1);
  });
});
