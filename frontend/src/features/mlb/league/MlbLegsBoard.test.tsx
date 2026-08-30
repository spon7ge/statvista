import { type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { components } from "@/shared/lib/api.schema";
import { MlbLegsBoard } from "./MlbLegsBoard";

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
    required_margin_pts: 5.5,
    margin_pts: 5.0,
    book_disagreement_pts: 4.5,
    payout_multiplier: 1,
    books_used: [
      {
        book: "pinnacle",
        line: 1.5,
        over: -120,
        under: 100,
        hold: 0.04,
        devig: "multiplicative",
        weight: 3,
        devigged_prob: 0.61,
      },
    ],
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

function renderBoard(path = "/mlb/legs?app=prizepicks&format=power&legs=4") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui: ReactElement = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <MlbLegsBoard />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(ui);
}

describe("MlbLegsBoard", () => {
  beforeEach(() => {
    mockUseMlbLegs.mockReset();
    mockUseMlbLegs.mockReturnValue({
      data: envelope(),
      isLoading: false,
      isError: false,
      isFetched: true,
    });
  });

  it("renders a mocked PLAY player", () => {
    renderBoard();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText(/Generated/)).toBeInTheDocument();
    expect(mockUseMlbLegs).toHaveBeenCalledWith({
      app: "prizepicks",
      format: "power",
      legs: 4,
    });
  });

  it("offers Flex 6 only — no Flex 3 control", async () => {
    const user = userEvent.setup();
    renderBoard();

    expect(
      screen.queryByRole("radio", { name: /flex 3/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /flex 3/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Flex" }));

    expect(screen.getByRole("radio", { name: "Flex" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "6-pick" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "3-pick" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /flex 3/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the same-game warning when flex_same_game_warning is true", () => {
    mockUseMlbLegs.mockReturnValue({
      data: envelope({
        format: "flex",
        flex_same_game_warning: true,
        base_break_even: 0.542,
        base_required_margin_pts: 3.0,
      }),
      isLoading: false,
      isError: false,
      isFetched: true,
    });
    renderBoard("/mlb/legs?app=prizepicks&format=flex&legs=6");

    const warning = screen.getByRole("alert");
    expect(warning).toHaveTextContent(/one game/i);
    expect(warning).toHaveTextContent(/3/i);
  });

  it("shows book hold, devig method, and weight in the expand panel", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(screen.getByText("Aaron Judge"));

    const audit = screen.getByText(/Over -120 \/ Under 100/);
    expect(audit).toHaveTextContent("1.5");
    expect(audit).toHaveTextContent(/hold 4\.0%/i);
    expect(audit).toHaveTextContent(/multiplicative/i);
    expect(audit).toHaveTextContent(/weight 3/i);
  });

  it("shows Underdog PLAY chrome as break_even_min–break_even_max", () => {
    mockUseMlbLegs.mockReturnValue({
      data: envelope({
        app: "underdog",
        format: "standard",
        break_even_min: 0.562,
        break_even_max: 0.625,
      }),
      isLoading: false,
      isError: false,
      isFetched: true,
    });
    renderBoard("/mlb/legs?app=underdog&format=standard&legs=4");

    expect(
      screen.getByText("PLAY break-even 56.2%–62.5%"),
    ).toBeInTheDocument();
  });
});
