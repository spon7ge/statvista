import { describe, expect, it } from "vitest";
import type { ApiMlbGameDetail } from "@/shared/lib/api";
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
      record: null,
      last_10: null,
    },
    home: {
      id: "119",
      abbrev: "LAD",
      name: "Los Angeles Dodgers",
      score: 1,
      color: "#005A9C",
      logo_url: null,
      record: null,
      last_10: null,
    },
    game_date: "2026-08-02",
    game_date_label: null,
    decisions: null,
    team_stats: null,
    season_team_stats: null,
    injuries: null,
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
        exit_velo: null,
        launch_angle: null,
        total_distance: null,
        scoring_team: null,
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
          hr: 1,
          era: "3.10",
          decision: "(L, 1-1)",
          strikes: 28,
          ground_outs: 2,
          fly_outs: 1,
          batters_faced: 12,
          inherited_runners: 0,
          inherited_runners_scored: 0,
        },
      ],
      away_batting_notes: [{ label: "2B", value: "Betts." }],
      home_batting_notes: [],
      away_baserunning_notes: [],
      home_baserunning_notes: [],
      away_fielding_notes: [],
      home_fielding_notes: [],
      away_pitching_totals: null,
      home_pitching_totals: {
        ip: "9.0",
        h: 8,
        r: 4,
        er: 4,
        bb: 2,
        k: 9,
        hr: 1,
        era: "4.00",
      },
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
        outcome: "Single",
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
    expect(mapped.gameDate).toBe("2026-08-02");
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
    expect(mapped.boxScore?.awayBattingNotes[0]).toEqual({
      label: "2B",
      value: "Betts.",
    });
    expect(mapped.boxScore?.homePitchers[0]?.decision).toBe("(L, 1-1)");
    expect(mapped.boxScore?.homePitchers[0]?.era).toBe("3.10");
    expect(mapped.boxScore?.homePitchers[0]?.strikes).toBe(28);
    expect(mapped.boxScore?.homePitchingTotals?.ip).toBe("9.0");
    expect(mapped.hitChart[0]?.playerName).toBe("Betts");
    expect(mapped.hitChart[0]?.outcome).toBe("Single");
    expect(mapped.seasonTeamStats).toBeNull();
    expect(mapped.injuries).toBeNull();
  });

  it("maps season_team_stats and injuries", () => {
    const view = mapMlbGameDetail(
      buildApiDetail({
        season_team_stats: {
          away: {
            hr: 1,
            r: 2,
            h: 3,
            avg: ".200",
            obp: ".300",
            slg: ".400",
            era: "4.00",
            so: 10,
            bb: 5,
          },
          home: {
            hr: 2,
            r: 3,
            h: 4,
            avg: ".250",
            obp: ".350",
            slg: ".450",
            era: "3.50",
            so: 12,
            bb: 4,
          },
        },
        injuries: {
          away: [{ name: "A", position: "P", status: "IL", detail: "Arm" }],
          home: [],
        },
      }),
    );
    expect(view.seasonTeamStats?.away.hr).toBe(1);
    expect(view.injuries?.away[0].name).toBe("A");
  });

  it("maps final additive fields", () => {
    const view = mapMlbGameDetail({
      ...buildApiDetail(),
      status: "final",
      game_date: "2026-08-04",
      game_date_label: "Today",
      away: {
        id: "109",
        abbrev: "ARI",
        name: "Arizona Diamondbacks",
        score: 4,
        color: "#A71930",
        logo_url: null,
        record: "58-55",
        last_10: "0-5",
      },
      home: {
        id: "119",
        abbrev: "LAD",
        name: "Los Angeles Dodgers",
        score: 5,
        color: "#005A9C",
        logo_url: null,
        record: "62-51",
        last_10: "3-2",
      },
      decisions: {
        winner: "Brandon Pfaadt",
        loser: "Walker Buehler",
        save: "Kevin Ginkel",
      },
      team_stats: {
        away: {
          avg: ".245",
          obp: ".320",
          slg: ".410",
          hr: 0,
          r: 4,
          h: 8,
          k: 10,
          sb: 1,
          lob: 6,
          era: "4.50",
        },
        home: {
          avg: ".268",
          obp: ".335",
          slg: ".445",
          hr: 1,
          r: 5,
          h: 9,
          k: 8,
          sb: 0,
          lob: 4,
          era: "3.20",
        },
      },
      plays: [
        {
          id: "p1",
          inning: 9,
          half: "bottom",
          text: "Freeman homers (2)",
          event: "Home Run",
          scoring: true,
          away_score: 4,
          home_score: 5,
          exit_velo: 104.1,
          launch_angle: 28.5,
          total_distance: 412,
          scoring_team: "home",
        },
      ],
    });

    expect(view.away.record).toBe("58-55");
    expect(view.away.last10).toBe("0-5");
    expect(view.home.last10).toBe("3-2");
    expect(view.gameDate).toBe("2026-08-04");
    expect(view.gameDateLabel).toBe("Today");
    expect(view.decisions?.winner).toBe("Brandon Pfaadt");
    expect(view.plays[0].exitVelo).toBe(104.1);
    expect(view.plays[0].scoringTeam).toBe("home");
    expect(view.teamStats?.home.hr).toBe(1);
  });

  it("maps game info venue location, weather, and umpires", () => {
    const view = mapMlbGameDetail(
      buildApiDetail({
        venue: "Yankee Stadium",
        venue_city: "Bronx",
        venue_state: "New York",
        weather: {
          condition: "Cloudy",
          temp_f: "74",
          wind: "2 mph N",
        },
        umpires: {
          home_plate: "Mark Ripperger",
          first_base: "Dan Merzel",
          second_base: "Dan Bellino",
          third_base: "Derek Thomas",
        },
      }),
    );

    expect(view.venue).toBe("Yankee Stadium");
    expect(view.venueCity).toBe("Bronx");
    expect(view.venueState).toBe("New York");
    expect(view.weather).toEqual({
      condition: "Cloudy",
      tempF: "74",
      wind: "2 mph N",
    });
    expect(view.umpires).toEqual({
      homePlate: "Mark Ripperger",
      firstBase: "Dan Merzel",
      secondBase: "Dan Bellino",
      thirdBase: "Derek Thomas",
    });
  });

  it("maps null game info fields when absent", () => {
    const view = mapMlbGameDetail(buildApiDetail());
    expect(view.venueCity).toBeNull();
    expect(view.venueState).toBeNull();
    expect(view.weather).toBeNull();
    expect(view.umpires).toBeNull();
  });

  it("maps situation headshots and pitch spin", () => {
    const raw = buildApiDetail({
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
            spin_rate: 2286,
            spin_direction: 63,
          },
        ],
        at_bat: {
          name: "Mookie Betts",
          hand: "R",
          summary: ".280 AVG",
          id: 605141,
          headshot_url:
            "https://img.mlbstatic.com/mlb-photos/image/upload/people/605141/headshot/67/current",
        },
        on_deck: { name: "Freddie Freeman", hand: "L", summary: null },
        pitching: { name: "Chris Sale", hand: "L", summary: "6 K" },
        latest_play_text: "Ball",
      },
    });

    const mapped = mapMlbGameDetail(raw);
    expect(mapped.situation?.atBat?.id).not.toBeNull();
    expect(mapped.situation?.atBat?.headshotUrl).toContain("people/");
    expect(mapped.situation?.pitches.some((p) => p.spinRate === 2286)).toBe(
      true,
    );
  });
});
