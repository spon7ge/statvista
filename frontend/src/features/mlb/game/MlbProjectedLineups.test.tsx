import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MlbProjectedLineups } from "./MlbProjectedLineups";
import { mlbScheduledDetail } from "../lib/testFixtures";
import type {
  ApiMlbLineupGame,
  ApiMlbLineupMatchupResponse,
} from "@/shared/lib/api";

const lineupGame: ApiMlbLineupGame = {
  away_abbrev: "WSH",
  home_abbrev: "PHI",
  status: null,
  away: {
    pitcher: { name: "MacKenzie Gore", hand: "L", era: "3.40", record: "8-6" },
    batters: [
      { order: 1, name: "CJ Abrams", position: "SS", hand: "L" },
      { order: 2, name: "James Wood", position: "LF", hand: "L" },
      { order: 3, name: "Josh Bell", position: "1B", hand: "S" },
      { order: 4, name: "Keibert Ruiz", position: "C", hand: "S" },
      { order: 5, name: "Luis Garcia", position: "2B", hand: "L" },
      { order: 6, name: "Jesse Winker", position: "DH", hand: "L" },
      { order: 7, name: "Alex Call", position: "CF", hand: "R" },
      { order: 8, name: "Trey Lipscomb", position: "3B", hand: "R" },
      { order: 9, name: "Robert Hassell III", position: "RF", hand: "L" },
    ],
  },
  home: {
    pitcher: { name: "Zack Wheeler", hand: "R", era: "2.80", record: "10-4" },
    batters: [
      { order: 1, name: "Trea Turner", position: "SS", hand: "R" },
      { order: 2, name: "Kyle Schwarber", position: "DH", hand: "L" },
      { order: 3, name: "Bryce Harper", position: "1B", hand: "L" },
      { order: 4, name: "Nick Castellanos", position: "RF", hand: "R" },
      { order: 5, name: "Alec Bohm", position: "3B", hand: "R" },
      { order: 6, name: "Brandon Marsh", position: "LF", hand: "L" },
      { order: 7, name: "Bryson Stott", position: "2B", hand: "L" },
      { order: 8, name: "J.T. Realmuto", position: "C", hand: "R" },
      { order: 9, name: "Johan Rojas", position: "CF", hand: "R" },
    ],
  },
};

const enrichedMatchup: ApiMlbLineupMatchupResponse = {
  date: "2026-08-04",
  away_abbrev: "WSH",
  home_abbrev: "PHI",
  status: "expected",
  source: "rotowire+statsapi",
  fetched_at: "2026-08-04T17:00:00Z",
  away: {
    pitcher: {
      name: "MacKenzie Gore",
      hand: "L",
      mlbam_id: 669022,
      wins: 8,
      losses: 6,
      era: "3.40",
      innings_pitched: "121.2",
      strikeouts: 142,
      whip: "1.21",
      k_per_9: "10.52",
      bb_per_9: "3.10",
      strikeout_walk_ratio: "3.39",
    },
    batters: [
      {
        order: 1,
        name: "CJ Abrams",
        position: "SS",
        hand: "L",
        mlbam_id: 682928,
        vs_pitcher: { ab: 10, h: 3, hr: 1, avg: ".300" },
      },
      {
        order: 2,
        name: "James Wood",
        position: "LF",
        hand: "L",
        mlbam_id: 695578,
        vs_pitcher: null,
      },
    ],
  },
  home: {
    pitcher: {
      name: "Zack Wheeler",
      hand: "R",
      mlbam_id: 554430,
      wins: 10,
      losses: 4,
      era: "2.80",
      innings_pitched: "132.0",
      strikeouts: 151,
      whip: "0.98",
      k_per_9: "10.30",
      bb_per_9: "2.05",
      strikeout_walk_ratio: "5.03",
    },
    batters: [
      {
        order: 1,
        name: "Trea Turner",
        position: "SS",
        hand: "R",
        mlbam_id: 607208,
        vs_pitcher: { ab: 7, h: 2, hr: 0, avg: ".286" },
      },
    ],
  },
};

describe("MlbProjectedLineups", () => {
  it("renders the RotoWire title", () => {
    render(<MlbProjectedLineups detail={mlbScheduledDetail} game={lineupGame} />);
    expect(
      screen.getByRole("heading", { name: /projected rotowire lineups/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("mlb-preview-lineups-odds-grid"),
    ).toHaveClass("lg:grid-cols-2");
    expect(
      screen.getByTestId("mlb-preview-lineups-odds-grid"),
    ).toContainElement(screen.getByTestId("mlb-preview-left-column"));
    expect(
      screen.getByTestId("mlb-preview-left-column"),
    ).toContainElement(screen.getByTestId("mlb-projected-lineups"));
    expect(
      screen.getByTestId("mlb-preview-lineups-odds-grid"),
    ).toContainElement(screen.getByTestId("mlb-game-odds-board"));
    expect(screen.getByTestId("mlb-projected-lineups")).not.toHaveClass(
      "sm:w-1/2",
    );
  });

  it("shows 'Lineups unavailable' when no matched game exists", () => {
    render(<MlbProjectedLineups detail={mlbScheduledDetail} game={null} />);
    expect(screen.getByText("Lineups unavailable")).toBeInTheDocument();
    expect(screen.queryByText("CJ Abrams")).not.toBeInTheDocument();
  });

  it("shows a loading line instead of 'Lineups unavailable' while pending", () => {
    render(
      <MlbProjectedLineups detail={mlbScheduledDetail} game={null} isPending />,
    );
    expect(screen.getByText("Loading lineups…")).toBeInTheDocument();
    expect(screen.queryByText("Lineups unavailable")).not.toBeInTheDocument();
  });

  it("renders the enriched pitcher season card and vs-pitcher table", () => {
    render(
      <MlbProjectedLineups
        detail={mlbScheduledDetail}
        game={lineupGame}
        matchup={enrichedMatchup}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "MacKenzie Gore - L" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lineup vs Zack Wheeler")).toBeInTheDocument();
    expect(screen.getByText("Record")).toBeInTheDocument();
    expect(screen.getByText("ERA")).toBeInTheDocument();
    expect(screen.getByText("WHIP")).toBeInTheDocument();
    expect(screen.getByText("K/9")).toBeInTheDocument();
    expect(screen.getByText("BB/9")).toBeInTheDocument();
    expect(screen.getByText("K/BB")).toBeInTheDocument();
    expect(screen.getByText("10.52")).toBeInTheDocument();
    expect(screen.getByText("3.10")).toBeInTheDocument();
    expect(screen.getByText("3.39")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "AB" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "H" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "HR" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "AVG" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /CJ Abrams/ })).toHaveTextContent(
      "1CJ AbramsSS1031.300",
    );
  });

  it("shows dashes when a batter has no vs-pitcher history", () => {
    render(
      <MlbProjectedLineups
        detail={mlbScheduledDetail}
        game={lineupGame}
        matchup={enrichedMatchup}
      />,
    );

    expect(screen.getByRole("row", { name: /James Wood/ })).toHaveTextContent(
      "2James WoodLF––––",
    );
  });

  it("keeps the full RotoWire lineup when matchup batters are partial", () => {
    const partialMatchup: ApiMlbLineupMatchupResponse = {
      ...enrichedMatchup,
      away: {
        ...enrichedMatchup.away!,
        batters: [
          {
            ...enrichedMatchup.away!.batters[0],
            name: "Stats API Name",
          },
        ],
      },
    };

    render(
      <MlbProjectedLineups
        detail={mlbScheduledDetail}
        game={lineupGame}
        matchup={partialMatchup}
      />,
    );

    expect(screen.getByText("CJ Abrams")).toBeInTheDocument();
    expect(screen.queryByText("Stats API Name")).not.toBeInTheDocument();
    expect(screen.getByText("Robert Hassell III")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /CJ Abrams/ })).toHaveTextContent(
      "1CJ AbramsSS1031.300",
    );
  });

  it("defaults to the away side and renders the starter plus 9 batters", () => {
    render(<MlbProjectedLineups detail={mlbScheduledDetail} game={lineupGame} />);

    expect(screen.getByTestId("mlb-lineup-toggle-away")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("mlb-lineup-toggle-home")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    expect(
      screen.getByRole("heading", { name: "MacKenzie Gore - L" }),
    ).toBeInTheDocument();
    expect(screen.getByText("CJ Abrams")).toBeInTheDocument();
    expect(screen.getByText("Robert Hassell III")).toBeInTheDocument();
    expect(screen.getByText("Lineup vs Zack Wheeler")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /CJ Abrams/ })).toHaveTextContent(
      "1CJ AbramsSS––––",
    );
  });

  it("switches to the home side's starter and batters on toggle", () => {
    render(<MlbProjectedLineups detail={mlbScheduledDetail} game={lineupGame} />);

    fireEvent.click(screen.getByTestId("mlb-lineup-toggle-home"));

    expect(screen.getByTestId("mlb-lineup-toggle-home")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: "Zack Wheeler - R" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lineup vs MacKenzie Gore")).toBeInTheDocument();
    expect(screen.getByText("Trea Turner")).toBeInTheDocument();
    expect(screen.getByText("Johan Rojas")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "MacKenzie Gore - L" }),
    ).not.toBeInTheDocument();
  });

  it("switches enriched lineup and opposing pitcher together", () => {
    render(
      <MlbProjectedLineups
        detail={mlbScheduledDetail}
        game={lineupGame}
        matchup={enrichedMatchup}
      />,
    );

    fireEvent.click(screen.getByTestId("mlb-lineup-toggle-home"));

    expect(
      screen.getByRole("heading", { name: "Zack Wheeler - R" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lineup vs MacKenzie Gore")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Trea Turner/ })).toHaveTextContent(
      "1Trea TurnerSS720.286",
    );
  });

  it("falls back to abbrev text toggles when team logos are missing", () => {
    render(<MlbProjectedLineups detail={mlbScheduledDetail} game={lineupGame} />);

    expect(screen.getByTestId("mlb-lineup-toggle-away")).toHaveTextContent("WSH");
    expect(screen.getByTestId("mlb-lineup-toggle-home")).toHaveTextContent("PHI");
  });

  it("renders season stats and injuries under lineups when unavailable", () => {
    render(
      <MlbProjectedLineups
        detail={{
          ...mlbScheduledDetail,
          seasonTeamStats: {
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
            away: [
              {
                name: "Dalton Rushing",
                position: "C",
                status: "10-Day IL",
                detail: "Arm",
              },
            ],
            home: [],
          },
        }}
        game={null}
      />,
    );
    expect(screen.getByText("Lineups unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-projected-lineups-stack")).toBeInTheDocument();
    const left = screen.getByTestId("mlb-preview-left-column");
    expect(left).toContainElement(screen.getByTestId("mlb-projected-lineups"));
    expect(left).toContainElement(screen.getByTestId("mlb-season-team-stats"));
    expect(left).toContainElement(screen.getByTestId("mlb-injury-report"));
  });
});
