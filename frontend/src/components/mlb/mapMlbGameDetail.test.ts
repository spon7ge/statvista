import { describe, expect, it } from "vitest";
import type { ApiMlbGameDetail } from "@/lib/api";
import { mapMlbGameDetail } from "./mapMlbGameDetail";

function buildApiDetail(
  overrides: Partial<ApiMlbGameDetail> = {},
): ApiMlbGameDetail {
  return {
    mlb_game_pk: "824971",
    league: "mlb",
    status: "live",
    status_label: "Top 3rd",
    venue: "Fenway Park",
    away: {
      id: "111",
      abbrev: "BOS",
      name: "Boston Red Sox",
      score: 2,
      color: "#BD3039",
      logo_url: "https://example.com/bos.png",
    },
    home: {
      id: "119",
      abbrev: "LAD",
      name: "Los Angeles Dodgers",
      score: 1,
      color: "#005A9C",
      logo_url: null,
    },
    linescore: {
      current_inning: 3,
      inning_half: "top",
      innings: [{ num: 1, away_runs: 0, home_runs: 1 }],
      away: { runs: 2, hits: 3, errors: 0 },
      home: { runs: 1, hits: 2, errors: 1 },
    },
    situation: {
      balls: 2,
      strikes: 1,
      outs: 1,
      runners: { first: true, second: false, third: false },
      pitches: [
        {
          number: 1,
          type: "FF",
          mph: 95.2,
          result: "Ball",
          is_strike: false,
          zone_x: 0.1,
          zone_y: 0.2,
        },
      ],
      at_bat: { name: "Mookie Betts", hand: "R", summary: ".280 AVG" },
      on_deck: { name: "Freddie Freeman", hand: "L", summary: null },
      pitching: { name: "Chris Sale", hand: "L", summary: "6 K" },
      latest_play_text: "Ball",
    },
    plays: [
      {
        id: "p1",
        inning: 3,
        half: "top",
        text: "Betts singles",
        event: "Single",
        scoring: false,
        away_score: 2,
        home_score: 1,
      },
    ],
    scoring_plays: [],
    box_score: {
      away_batters: [
        {
          name: "Betts",
          position: "RF",
          order: 1,
          ab: 2,
          r: 1,
          h: 1,
          rbi: 0,
          bb: 0,
          so: 0,
          hr: 1,
          sb: 0,
        },
      ],
      home_batters: [],
      away_pitchers: [],
      home_pitchers: [
        {
          name: "Sale",
          ip: "2.1",
          h: 3,
          r: 2,
          er: 2,
          bb: 1,
          k: 3,
          pitches: 42,
        },
      ],
    },
    win_probability: {
      away_abbrev: "BOS",
      home_abbrev: "LAD",
      points: [{ play_id: "p1", label: "Top 3", home_win_pct: 0.48 }],
      stakes: { label: "On this pitch", home_win_delta: -2.1 },
    },
    hit_chart: [
      {
        id: "h1",
        team: "away",
        player_name: "Betts",
        result: "hit",
        x: 0.4,
        y: 0.5,
      },
    ],
    sources: ["statsapi", "espn"],
    fetched_at: "2026-08-02T00:00:00Z",
    ...overrides,
  };
}

describe("mapMlbGameDetail", () => {
  it("maps mlb_game_pk, sources, and status to camelCase UI fields", () => {
    const mapped = mapMlbGameDetail(buildApiDetail());
    expect(mapped.mlbGamePk).toBe("824971");
    expect(mapped.status).toBe("live");
    expect(mapped.sources).toEqual(["statsapi", "espn"]);
    expect(mapped.statusLabel).toBe("Top 3rd");
    expect(mapped.away.name).toBe("Boston Red Sox");
    expect(mapped.away.logoUrl).toBe("https://example.com/bos.png");
    expect(mapped.home.logoUrl).toBeNull();
    expect(mapped.linescore?.currentInning).toBe(3);
    expect(mapped.linescore?.inningHalf).toBe("top");
    expect(mapped.situation?.atBat?.name).toBe("Mookie Betts");
    expect(mapped.winProbability?.homeAbbrev).toBe("LAD");
    expect(mapped.boxScore?.awayBatters[0]?.name).toBe("Betts");
    expect(mapped.boxScore?.awayBatters[0]?.hr).toBe(1);
    expect(mapped.boxScore?.awayBatters[0]?.sb).toBe(0);
    expect(mapped.hitChart[0]?.playerName).toBe("Betts");
  });
});
