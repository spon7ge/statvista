import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbFinalCenter } from "./MlbFinalCenter";
import { mlbFinalDetail } from "../lib/testFixtures";

describe("MlbFinalCenter", () => {
  it("renders Summary with charts under team stats; hides charts on Boxscore", async () => {
    const user = userEvent.setup();
    render(<MlbFinalCenter detail={mlbFinalDetail} />);
    const root = screen.getByTestId("mlb-final-center");
    expect(root).toBeInTheDocument();

    expect(
      screen.getByTestId("mlb-final-broadcast-header"),
    ).toBeInTheDocument();
    const header = screen.getByTestId("mlb-final-broadcast-header");
    expect(
      within(header).getByRole("tablist", { name: /final game details/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
    expect(screen.getByTestId("mlb-final-play-feed")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-final-team-stats")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-flow")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-chart")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-info")).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-box-score")).not.toBeInTheDocument();

    const summary = screen.getByRole("tabpanel", {
      name: /summary/i,
    });
    expect(summary).toHaveClass("lg:grid-cols-2");
    const teamStats = within(summary).getByTestId("mlb-final-team-stats");
    const gameFlow = within(summary).getByTestId("mlb-game-flow");
    const hitChart = within(summary).getByTestId("mlb-hit-chart");
    const gameInfo = within(summary).getByTestId("mlb-game-info");
    expect(
      teamStats.compareDocumentPosition(gameFlow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      gameFlow.compareDocumentPosition(hitChart) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      hitChart.compareDocumentPosition(gameInfo) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /boxscore/i }));

    expect(screen.getByTestId("mlb-box-score")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-box-score-layout")).toHaveClass(
      "grid-cols-2",
      "gap-2",
    );
    expect(screen.queryByTestId("mlb-final-play-feed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-game-flow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-hit-chart")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-game-info")).not.toBeInTheDocument();
  });

  it("renders Player of the Game above play feed when present", () => {
    render(
      <MlbFinalCenter
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

    const potg = screen.getByTestId("mlb-player-of-the-game");
    const playFeed = screen.getByTestId("mlb-final-play-feed");
    expect(
      potg.compareDocumentPosition(playFeed) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
