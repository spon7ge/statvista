import { describe, expect, it } from "vitest";
import type { ApiMlbStandingsLeague } from "@/shared/lib/api";
import { buildMlbConferenceStandings } from "./buildMlbConferenceStandings";

function row(
  partial: Partial<ApiMlbStandingsLeague["divisions"][number]["teams"][number]> & {
    team_id: string;
    abbrev: string;
    wins: number;
    losses: number;
    pct: string;
  },
) {
  return {
    rank: partial.rank ?? 1,
    team_id: partial.team_id,
    abbrev: partial.abbrev,
    name: partial.name ?? partial.abbrev,
    logo_url: null,
    wins: partial.wins,
    losses: partial.losses,
    wl: `${partial.wins}-${partial.losses}`,
    pct: partial.pct,
    gb: partial.gb ?? "-",
    l10: partial.l10 ?? "5-5",
    streak: partial.streak ?? "W1",
  };
}

const sample: ApiMlbStandingsLeague[] = [
  {
    key: "al",
    label: "American League",
    divisions: [
      {
        key: "al_east",
        label: "AL East",
        teams: [
          row({ team_id: "1", abbrev: "NYY", wins: 60, losses: 40, pct: ".600" }),
          row({ team_id: "2", abbrev: "BOS", wins: 50, losses: 50, pct: ".500" }),
        ],
      },
      {
        key: "al_central",
        label: "AL Central",
        teams: [
          row({ team_id: "3", abbrev: "CLE", wins: 55, losses: 45, pct: ".550" }),
        ],
      },
    ],
  },
  {
    key: "nl",
    label: "National League",
    divisions: [
      {
        key: "nl_east",
        label: "NL East",
        teams: [
          row({ team_id: "4", abbrev: "PHI", wins: 58, losses: 42, pct: ".580" }),
        ],
      },
    ],
  },
];

describe("buildMlbConferenceStandings", () => {
  it("returns AL then NL sections with teams sorted by pct then wins", () => {
    const sections = buildMlbConferenceStandings(sample);
    expect(sections.map((s) => s.key)).toEqual(["al", "nl"]);
    expect(sections[0].teams.map((t) => t.abbrev)).toEqual(["NYY", "CLE", "BOS"]);
    expect(sections[0].teams.map((t) => t.rank)).toEqual([1, 2, 3]);
  });

  it("recomputes GB vs league leader (half games included)", () => {
    const sections = buildMlbConferenceStandings(sample);
    expect(sections[0].teams[0].gb).toBe("-");
    // CLE: ((60-55)+(45-40))/2 = 5
    expect(sections[0].teams[1].gb).toBe("5");
    // BOS: ((60-50)+(50-40))/2 = 10
    expect(sections[0].teams[2].gb).toBe("10");
  });

  it("formats half-game GB with one decimal", () => {
    const leagues: ApiMlbStandingsLeague[] = [
      {
        key: "al",
        label: "American League",
        divisions: [
          {
            key: "al_east",
            label: "AL East",
            teams: [
              row({ team_id: "1", abbrev: "A", wins: 50, losses: 50, pct: ".500" }),
              row({ team_id: "2", abbrev: "B", wins: 49, losses: 50, pct: ".495" }),
            ],
          },
        ],
      },
    ];
    const [al] = buildMlbConferenceStandings(leagues);
    expect(al.teams[1].gb).toBe("0.5");
  });

  it("returns empty array for empty leagues", () => {
    expect(buildMlbConferenceStandings([])).toEqual([]);
  });
});
