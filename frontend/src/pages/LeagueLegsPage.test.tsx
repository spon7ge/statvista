import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { components } from "@/shared/lib/api.schema";
import { LeagueLegsPage } from "./LeagueLegsPage";

type MlbLegsResponse = components["schemas"]["MlbLegsResponse"];
type MlbLegsPlay = components["schemas"]["LegsPlay"];

const mockUseMlbLegs = vi.fn();
const mockUseWnbaLegs = vi.fn();

vi.mock("@/features/mlb/hooks/useMlbLegs", () => ({
  useMlbLegs: (...args: unknown[]) => mockUseMlbLegs(...args),
}));

vi.mock("@/features/basketball/hooks/useWnbaLegs", () => ({
  useWnbaLegs: (...args: unknown[]) => mockUseWnbaLegs(...args),
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
    headshot_url: null,
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
    legs_surfaced: 4,
    coverage_funnel_ratio: 0.1,
    flex_same_game_warning: false,
    entries: [
      {
        rank: 1,
        legs: [
          play({ rank: 1 }),
          play({ rank: 2 }),
          play({ rank: 3 }),
          play({ rank: 4 }),
        ],
      },
    ],
    rejected_summary: {
      below_threshold: 30,
      insufficient_coverage: 5,
      insufficient_sharp: 4,
      unpriceable_payout: 0,
      unpacked_remainder: 0,
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
    mockUseWnbaLegs.mockReset();
    mockUseWnbaLegs.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      isFetched: true,
    });
  });

  it("renders Legs chrome with league pills", () => {
    renderPage("/mlb/legs");
    const heading = screen.getByRole("heading", { name: "Legs" });
    expect(heading).toHaveClass("chrome-title");
    expect(heading.parentElement).toHaveClass("chrome-title-row");
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

  it("fetches WNBA legs, not MLB, on /wnba/legs", () => {
    mockUseWnbaLegs.mockReturnValue({
      data: envelope({ slate: "WNBA 2026-08-30" }),
      isLoading: false,
      isError: false,
      isFetched: true,
    });
    renderPage("/wnba/legs");
    expect(mockUseMlbLegs).not.toHaveBeenCalled();
    expect(mockUseWnbaLegs).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Entry 1" })).toBeInTheDocument();
  });

  it("renders Entry 1 and a mocked PLAY player on /mlb/legs", () => {
    mockUseMlbLegs.mockReturnValue({
      data: envelope(),
      isLoading: false,
      isError: false,
      isFetched: true,
    });
    renderPage("/mlb/legs");
    expect(mockUseMlbLegs).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Entry 1" })).toBeInTheDocument();
    expect(screen.getAllByText("Aaron Judge").length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/No legs cleared the margin/i),
    ).not.toBeInTheDocument();
  });

  it("ignores ?example=1 on /mlb/legs and shows live entries only", () => {
    mockUseMlbLegs.mockReturnValue({
      data: envelope(),
      isLoading: false,
      isError: false,
      isFetched: true,
    });
    renderPage("/mlb/legs?example=1");
    expect(screen.queryByText(/layout-only/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entry 1" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Entry 2" }),
    ).not.toBeInTheDocument();
  });
});
