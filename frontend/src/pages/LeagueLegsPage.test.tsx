import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { components } from "@/shared/lib/api.schema";
import { LeagueLegsPage } from "./LeagueLegsPage";

type MlbLegsResponse = components["schemas"]["MlbLegsResponse"];
type MlbLegsPlay = components["schemas"]["MlbLegsPlay"];

const mockUseMlbLegs = vi.fn();

vi.mock("@/features/mlb/hooks/useMlbLegs", () => ({
  useMlbLegs: (...args: unknown[]) => mockUseMlbLegs(...args),
}));

function play(over: Partial<MlbLegsPlay> = {}): MlbLegsPlay {
  return {
    rank: 1,
    player: "Aaron Judge",
    team: "NYY",
    matchup: "NYY @ BOS",
    market: "Hits",
    dfs_line: 1.5,
    side: "over",
    variant: "standard",
    game_id: "776123",
    sharp_anchor: "pinnacle",
    fair_prob: 0.612,
    break_even: 0.562,
    required_margin_pts: 4.0,
    margin_pts: 5.0,
    book_disagreement_pts: 1.2,
    payout_multiplier: 1,
    books_used: [],
    books_excluded: [],
    ...over,
  };
}

function envelope(over: Partial<MlbLegsResponse> = {}): MlbLegsResponse {
  return {
    generated_at: "2026-08-29T20:00:00Z",
    slate: "MLB 2026-08-29",
    app: "prizepicks",
    format: "power",
    payouts_assumed: true,
    base_break_even: 0.562,
    break_even_min: 0.562,
    break_even_max: 0.562,
    base_required_margin_pts: 4.0,
    dfs_snapshot_age_minutes: 12,
    lines_seeded: 40,
    legs_evaluated: 40,
    legs_surfaced: 1,
    coverage_funnel_ratio: 0.1,
    flex_same_game_warning: false,
    legs: [play()],
    rejected_summary: {
      below_threshold: 30,
      insufficient_coverage: 5,
      insufficient_sharp: 4,
      unpriceable_payout: 0,
    },
    warnings: [],
    disclaimers: [],
    ...over,
  };
}

function renderPage(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <LeagueLegsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeagueLegsPage", () => {
  beforeEach(() => {
    mockUseMlbLegs.mockReset();
    mockUseMlbLegs.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      isFetched: true,
    });
  });

  it("renders Legs chrome with league pills", () => {
    renderPage("/mlb/legs");
    expect(screen.getByRole("heading", { name: "Legs" })).toHaveClass(
      "text-white",
    );
    expect(screen.getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/legs",
    );
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/legs",
    );
    expect(screen.getByRole("button", { name: "NBA" })).toBeDisabled();
  });

  it("does not fetch MLB legs on /wnba/legs", () => {
    renderPage("/wnba/legs");
    expect(screen.getByRole("heading", { name: "Legs" })).toBeInTheDocument();
    expect(mockUseMlbLegs).not.toHaveBeenCalled();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders a mocked PLAY player on /mlb/legs", () => {
    mockUseMlbLegs.mockReturnValue({
      data: envelope(),
      isLoading: false,
      isError: false,
      isFetched: true,
    });
    renderPage("/mlb/legs");
    expect(mockUseMlbLegs).toHaveBeenCalled();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
  });
});
