import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MlbFuturesPage } from "./MlbFuturesPage";
import { useMlbFutures } from "@/features/mlb/hooks/useMlbFutures";

vi.mock("@/features/mlb/hooks/useMlbFutures");

const mockUseMlbFutures = vi.mocked(useMlbFutures);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/mlb/futures"]}>
        <MlbFuturesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MlbFuturesPage", () => {
  beforeEach(() => {
    mockUseMlbFutures.mockReturnValue({
      data: {
        season: 2026,
        as_of: "2026-08-08T00:00:00Z",
        markets: [
          {
            id: "2761",
            name: "MLB  - World Series - Winner",
            display_name: "World Series Winner",
            provider: "DraftKings",
            entries: [
              {
                team_id: "10",
                abbrev: "NYY",
                name: "New York Yankees",
                logo_url: null,
                odds_american: "+450",
              },
            ],
          },
        ],
        error: null,
      },
      isLoading: false,
      hasNeverLoaded: false,
      isError: false,
      isSuccess: true,
      status: "success",
      fetchStatus: "idle",
      error: null,
      isPending: false,
      isLoadingError: false,
      isRefetchError: false,
      isPlaceholderData: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isPaused: false,
      isRefetching: false,
      isStale: false,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isEnabled: true,
      promise: Promise.resolve(undefined),
      refetch: vi.fn(),
    });
  });

  it("renders header, board, and active Futures subnav", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "MLB 2026 Futures" }),
    ).toBeInTheDocument();
    expect(screen.getByText("World Series Winner")).toBeInTheDocument();
    expect(screen.getByText("New York Yankees")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Futures" })).toHaveAttribute(
      "href",
      "/mlb/futures",
    );
    expect(screen.getByRole("link", { name: "Futures" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("tab", { name: "World Series" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
