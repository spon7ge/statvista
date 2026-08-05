import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbLiveCenter } from "./MlbLiveCenter";
import { mlbLiveDetail } from "../lib/testFixtures";

describe("MlbLiveCenter", () => {
  it("renders Summary with matchup above pitch zone above play feed and linescore atop right rail", async () => {
    const user = userEvent.setup();
    render(<MlbLiveCenter detail={mlbLiveDetail} />);

    const root = screen.getByTestId("mlb-live-center");
    expect(root).toBeInTheDocument();
    expect(screen.getByTestId("mlb-broadcast-header")).toBeInTheDocument();

    const summary = screen.getByRole("tabpanel", { name: /summary/i });
    const matchup = within(summary).getByTestId("mlb-live-matchup");
    const pitchZone = within(summary).getByTestId("mlb-pitch-zone");
    const playFeed = within(summary).getByTestId("mlb-final-play-feed");
    const linescore = within(summary).getByTestId("mlb-final-linescore-card");
    const teamStats = within(summary).getByTestId("mlb-final-team-stats");
    const gameFlow = within(summary).getByTestId("mlb-game-flow");
    const hitChart = within(summary).getByTestId("mlb-hit-chart");

    expect(
      matchup.compareDocumentPosition(pitchZone) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      pitchZone.compareDocumentPosition(playFeed) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      linescore.compareDocumentPosition(teamStats) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      teamStats.compareDocumentPosition(gameFlow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      gameFlow.compareDocumentPosition(hitChart) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.queryByTestId("mlb-box-score")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /box/i }));

    expect(screen.getByTestId("mlb-box-score")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-box-score-layout")).toHaveClass(
      "grid-cols-2",
    );
    expect(screen.queryByTestId("mlb-final-play-feed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-live-matchup")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-pitch-zone")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-game-flow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-hit-chart")).not.toBeInTheDocument();
  });
});
