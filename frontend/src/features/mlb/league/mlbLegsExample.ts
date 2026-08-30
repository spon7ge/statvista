import type { ApiMlbLegsPlay, ApiMlbLegsResponse } from "@/shared/lib/api";

export const EXAMPLE_LAYOUT_BANNER =
  "Example layout-only — not live pricing.";

const FIXTURE_PLAYERS: ReadonlyArray<{
  player: string;
  team: string;
  matchup: string;
  market: string;
}> = [
  { player: "Aaron Judge", team: "NYY", matchup: "NYY @ BOS", market: "Hits" },
  {
    player: "Juan Soto",
    team: "NYM",
    matchup: "NYM vs PHI",
    market: "Total Bases",
  },
  {
    player: "Shohei Ohtani",
    team: "LAD",
    matchup: "LAD @ SD",
    market: "Hits",
  },
  {
    player: "Mookie Betts",
    team: "LAD",
    matchup: "LAD @ SD",
    market: "Hits",
  },
  {
    player: "Ronald Acuna Jr.",
    team: "ATL",
    matchup: "ATL vs MIA",
    market: "Stolen Bases",
  },
  {
    player: "Freddie Freeman",
    team: "LAD",
    matchup: "LAD @ SD",
    market: "Hits",
  },
  {
    player: "Jose Ramirez",
    team: "CLE",
    matchup: "CLE vs KC",
    market: "Hits",
  },
  {
    player: "Francisco Lindor",
    team: "NYM",
    matchup: "NYM vs PHI",
    market: "Hits",
  },
  {
    player: "Rafael Devers",
    team: "SF",
    matchup: "SF @ COL",
    market: "Total Bases",
  },
  {
    player: "Julio Rodriguez",
    team: "SEA",
    matchup: "SEA vs HOU",
    market: "Hits",
  },
  {
    player: "Gunnar Henderson",
    team: "BAL",
    matchup: "BAL @ TB",
    market: "Hits",
  },
  {
    player: "Corey Seager",
    team: "TEX",
    matchup: "TEX vs LAA",
    market: "Hits",
  },
];

function examplePlay(
  index: number,
  rank: number,
): ApiMlbLegsPlay {
  const fixture = FIXTURE_PLAYERS[index];
  if (!fixture) {
    throw new Error(`mlbLegsExample needs a unique player at index ${index}`);
  }
  return {
    rank,
    player: fixture.player,
    team: fixture.team,
    matchup: fixture.matchup,
    market: fixture.market,
    dfs_line: 1.5,
    side: "over",
    variant: "standard",
    game_id: String(770000 + index),
    sharp_anchor: "pinnacle",
    fair_prob: 0.61,
    break_even: 0.562,
    required_margin_pts: 4.0,
    margin_pts: 5.0,
    book_disagreement_pts: 1.0,
    payout_multiplier: 1,
    books_used: [],
    books_excluded: [],
  };
}

/** Layout-only cards for `?example=1`. Not live pricing. */
export function mlbLegsExampleEnvelope(args: {
  app: string;
  format: string;
  legs: number;
}): ApiMlbLegsResponse {
  const n = args.legs;
  const needed = n * 2;
  if (needed > FIXTURE_PLAYERS.length) {
    throw new Error(`mlbLegsExample supports at most ${FIXTURE_PLAYERS.length} unique players`);
  }
  const entries = [1, 2].map((rank) => ({
    rank,
    legs: Array.from({ length: n }, (_, i) =>
      examplePlay((rank - 1) * n + i, i + 1),
    ),
  }));
  return {
    generated_at: "2026-08-29T20:00:00Z",
    slate: "MLB example layout",
    app: args.app,
    format: args.format,
    payouts_assumed: true,
    base_break_even: 0.562,
    break_even_min: 0.562,
    break_even_max: 0.562,
    base_required_margin_pts: 4.0,
    dfs_snapshot_age_minutes: 0,
    lines_seeded: needed,
    legs_evaluated: needed,
    legs_surfaced: needed,
    coverage_funnel_ratio: 1,
    flex_same_game_warning: false,
    entries,
    rejected_summary: {
      below_threshold: 0,
      insufficient_coverage: 0,
      insufficient_sharp: 0,
      unpriceable_payout: 0,
      unpacked_remainder: 0,
    },
    warnings: [],
    disclaimers: [EXAMPLE_LAYOUT_BANNER],
  };
}
