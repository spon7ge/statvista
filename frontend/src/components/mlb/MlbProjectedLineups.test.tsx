import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MlbProjectedLineups } from "./MlbProjectedLineups";
import { mlbScheduledDetail } from "./testFixtures";
import type { ApiMlbLineupGame } from "@/lib/api";

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

describe("MlbProjectedLineups", () => {
  it("renders the RotoWire title", () => {
    render(<MlbProjectedLineups detail={mlbScheduledDetail} game={lineupGame} />);
    expect(
      screen.getByText("Projected lineups · RotoWire expected lineup"),
    ).toBeInTheDocument();
  });

  it("shows 'Lineups unavailable' when no matched game exists", () => {
    render(<MlbProjectedLineups detail={mlbScheduledDetail} game={null} />);
    expect(screen.getByText("Lineups unavailable")).toBeInTheDocument();
    expect(screen.queryByText("CJ Abrams")).not.toBeInTheDocument();
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

    expect(screen.getByText("MacKenzie Gore")).toBeInTheDocument();
    expect(screen.getByText("CJ Abrams")).toBeInTheDocument();
    expect(screen.getByText("Robert Hassell III")).toBeInTheDocument();
    expect(screen.queryByText("Zack Wheeler")).not.toBeInTheDocument();
  });

  it("switches to the home side's starter and batters on toggle", () => {
    render(<MlbProjectedLineups detail={mlbScheduledDetail} game={lineupGame} />);

    fireEvent.click(screen.getByTestId("mlb-lineup-toggle-home"));

    expect(screen.getByTestId("mlb-lineup-toggle-home")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Zack Wheeler")).toBeInTheDocument();
    expect(screen.getByText("Trea Turner")).toBeInTheDocument();
    expect(screen.getByText("Johan Rojas")).toBeInTheDocument();
    expect(screen.queryByText("MacKenzie Gore")).not.toBeInTheDocument();
  });

  it("falls back to abbrev text toggles when team logos are missing", () => {
    render(<MlbProjectedLineups detail={mlbScheduledDetail} game={lineupGame} />);

    expect(screen.getByTestId("mlb-lineup-toggle-away")).toHaveTextContent("WSH");
    expect(screen.getByTestId("mlb-lineup-toggle-home")).toHaveTextContent("PHI");
  });
});
