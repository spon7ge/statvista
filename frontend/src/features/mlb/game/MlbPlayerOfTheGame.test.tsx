import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbPlayerOfTheGame } from "./MlbPlayerOfTheGame";
import { mlbFinalDetail } from "../lib/testFixtures";

describe("MlbPlayerOfTheGame", () => {
  it("renders nothing when playerOfTheGame is null", () => {
    const { container } = render(
      <MlbPlayerOfTheGame detail={{ ...mlbFinalDetail, playerOfTheGame: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders stacked card with title, name, and stats", () => {
    render(
      <MlbPlayerOfTheGame
        detail={{
          ...mlbFinalDetail,
          playerOfTheGame: {
            playerId: "592450",
            fullName: "Aaron Judge",
            lastName: "Judge",
            teamAbbrev: "NYY",
            headshotUrl: "https://example.test/judge.png",
            stats: [{ label: null, value: "3-4 · 2 HR · 5 RBI" }],
            source: "mlb_player_of_the_game",
          },
        }}
      />,
    );
    expect(screen.getByTestId("mlb-player-of-the-game")).toBeInTheDocument();
    expect(screen.getByText("PLAYER OF THE GAME")).toBeInTheDocument();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("3-4 · 2 HR · 5 RBI")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-player-of-the-game-headshot")).toHaveAttribute(
      "src",
      "https://example.test/judge.png",
    );
  });
});
