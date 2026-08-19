import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApiWnbaPropRow } from "@/shared/lib/api";
import { WnbaPlayerPropsOddsGrid } from "./WnbaPlayerPropsOddsGrid";

function row(
  partial: Partial<ApiWnbaPropRow> & Pick<ApiWnbaPropRow, "player_name" | "stat">,
): ApiWnbaPropRow {
  return {
    team_abbrev: "IND",
    position: "G",
    headshot_url: null,
    commence_time: null,
    line: 18.5,
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
      line: partial.line ?? 18.5,
      changed_at: null,
      american: null,
      payout_multiplier: null,
    },
    fair_explain: "",
    ...partial,
  };
}

const points = row({
  player_name: "Caitlin Clark",
  stat: "Points",
  line: 18.5,
  books_main: {
    prophetx: {
      line: 18.5,
      over_american: -110,
      under_american: -110,
      changed_at: null,
    },
    novig: null,
    draftkings: null,
    fanduel: {
      line: 18.5,
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

describe("WnbaPlayerPropsOddsGrid", () => {
  it("renders main over/under per book and NL when missing", () => {
    render(<WnbaPlayerPropsOddsGrid markets={[points]} />);

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
    expect(screen.getByText("Points")).toBeInTheDocument();
    expect(screen.getByText("18.5")).toBeInTheDocument();
    expect(screen.getByText("O 18.5 (-110)")).toBeInTheDocument();
    expect(screen.getByText("U 18.5 (-110)")).toBeInTheDocument();
    expect(screen.getByText("O 18.5 (-105)")).toBeInTheDocument();
    expect(screen.getAllByText("NL").length).toBe(8);
    expect(screen.queryByText("OPEN")).not.toBeInTheDocument();
    expect(screen.queryByText("BEST")).not.toBeInTheDocument();
  });
});
