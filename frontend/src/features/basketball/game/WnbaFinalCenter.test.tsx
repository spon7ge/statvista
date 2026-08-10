import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildGameDetailFixture } from "../lib/testFixtures";
import { WnbaFinalCenter } from "./WnbaFinalCenter";

const boxScoreFixture = {
  columns: ["MIN", "PTS"],
  away: [
    {
      name: "Kayla Thornton",
      didNotPlay: false,
      values: ["25", "6"],
    },
  ],
  home: [
    {
      name: "Alyssa Thomas",
      didNotPlay: false,
      values: ["30", "12"],
    },
  ],
};

describe("WnbaFinalCenter", () => {
  it("renders summary with play feed and shot chart under final center", () => {
    render(
      <WnbaFinalCenter
        detail={buildGameDetailFixture({ status: "final", statusLabel: "Final" })}
      />,
    );

    expect(screen.getByTestId("wnba-final-center")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-broadcast-header")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-play-feed")).toBeInTheDocument();
    expect(screen.getByText("Shot chart")).toBeInTheDocument();
  });

  it("orders the summary rail and switches to BoxScore on Box tab", async () => {
    const user = userEvent.setup();
    render(
      <WnbaFinalCenter
        detail={buildGameDetailFixture({
          status: "final",
          statusLabel: "Final",
          boxScore: boxScoreFixture,
        })}
      />,
    );

    const summary = screen.getByRole("tabpanel", { name: /summary/i });
    expect(summary).toHaveClass("lg:grid-cols-2");

    const shotChart = within(summary).getByTestId("wnba-shot-chart");
    const playFeed = within(summary).getByTestId("wnba-play-feed");
    const quarter = within(summary).getByTestId("wnba-quarter-score-card");
    const teamStats = within(summary).getByTestId("wnba-team-stats-card");
    const winProb = within(summary).getByText("Win probability");
    const gameInfo = within(summary).getByTestId("wnba-game-info");

    expect(
      shotChart.compareDocumentPosition(playFeed) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      playFeed.compareDocumentPosition(quarter) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      quarter.compareDocumentPosition(teamStats) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      teamStats.compareDocumentPosition(winProb) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      winProb.compareDocumentPosition(gameInfo) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.queryByText("Kayla Thornton")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-player-of-the-game")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-pitch-zone")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^box$/i }));

    expect(screen.getByText("Kayla Thornton")).toBeInTheDocument();
    expect(screen.queryByTestId("wnba-play-feed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wnba-shot-chart")).not.toBeInTheDocument();
  });
});
