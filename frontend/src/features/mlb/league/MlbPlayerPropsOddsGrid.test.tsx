import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApiMlbPropRow } from "@/shared/lib/api";
import { MlbPlayerPropsOddsGrid } from "./MlbPlayerPropsOddsGrid";

function row(
  partial: Partial<ApiMlbPropRow> & Pick<ApiMlbPropRow, "player_name" | "stat">,
): ApiMlbPropRow {
  return {
    team_abbrev: "NYY",
    position: "RF",
    headshot_url: null,
    line: 1.5,
    recommended_side: "over",
    fair_pct: null,
    edge_pct: null,
    alt_edge_pct: null,
    source_tier: "no_sharp_read",
    confidence_chips: [],
    sample_chips: [],
    recency_chip: null,
    books: {
      prophetx: null,
      novig: null,
      draftkings: null,
      fanduel: null,
      betmgm: null,
      caesars: null,
      kalshi: null,
      fliff: null,
      bet365: null,
      pinnacle: null,
    },
    books_main: {
      prophetx: null,
      novig: null,
      draftkings: null,
      fanduel: null,
      betmgm: null,
      caesars: null,
      kalshi: null,
      fliff: null,
      bet365: null,
      pinnacle: null,
    },
    dfs: {
      line: partial.line ?? 1.5,
      changed_at: null,
      american: null,
      payout_multiplier: null,
    },
    fair_explain: "",
    ...partial,
  };
}

const hits = row({
  player_name: "Aaron Judge",
  stat: "Hits",
  line: 1.5,
  books_main: {
    prophetx: {
      line: 1.5,
      over_american: -110,
      under_american: -110,
      changed_at: null,
    },
    novig: null,
    draftkings: null,
    fanduel: {
      line: 1.5,
      over_american: -105,
      under_american: -115,
      changed_at: null,
    },
    betmgm: null,
    caesars: null,
    kalshi: null,
    fliff: null,
    bet365: null,
    pinnacle: null,
  },
});

describe("MlbPlayerPropsOddsGrid", () => {
  it("renders main over/under per book and NL when missing", () => {
    render(<MlbPlayerPropsOddsGrid markets={[hits]} />);

    expect(screen.getByText("Market")).toBeInTheDocument();
    expect(screen.getByText("ProphetX")).toBeInTheDocument();
    expect(screen.getByText("Novig")).toBeInTheDocument();
    expect(screen.getByText("DraftKings")).toBeInTheDocument();
    expect(screen.getByText("FanDuel")).toBeInTheDocument();
    expect(screen.getByText("BetMGM")).toBeInTheDocument();
    expect(screen.getByText("Caesars")).toBeInTheDocument();
    expect(screen.getByText("Kalshi")).toBeInTheDocument();
    expect(screen.getByText("Fliff")).toBeInTheDocument();
    expect(screen.getByText("bet365")).toBeInTheDocument();
    expect(screen.getByText("Pinnacle")).toBeInTheDocument();
    expect(screen.getByText("Hits")).toBeInTheDocument();
    expect(screen.getByText("1.5")).toBeInTheDocument();
    expect(screen.getAllByText("O 1.5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("U 1.5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("(-110)").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("(-105)")).toBeInTheDocument();
    expect(screen.getAllByText("NL").length).toBe(8);
    expect(screen.queryByText("OPEN")).not.toBeInTheDocument();
    expect(screen.queryByText("BEST")).not.toBeInTheDocument();
  });
});
