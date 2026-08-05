import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MlbFinalPlayFeed } from "./MlbFinalPlayFeed";
import { mlbFinalDetail } from "../lib/testFixtures";

describe("MlbFinalPlayFeed", () => {
  it("defaults to scoring plays and shows the Statcast metrics", () => {
    render(<MlbFinalPlayFeed detail={mlbFinalDetail} />);

    expect(screen.getByTestId("mlb-final-play-feed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /scoring plays/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Bottom 9th")).toBeInTheDocument();
    expect(screen.getByText("104.1 mph")).toBeInTheDocument();
    expect(screen.getByText("412 ft")).toBeInTheDocument();
    expect(screen.getByText("28.5°")).toBeInTheDocument();
  });

  it("shows non-scoring plays after toggling to all plays", async () => {
    const user = userEvent.setup();
    const nonScoringPlay = {
      ...mlbFinalDetail.plays[0],
      id: "p-final-non-scoring",
      text: "Smith strikes out swinging",
      event: "Strikeout",
      scoring: false,
      scoringTeam: null,
      exitVelo: null,
      launchAngle: null,
      totalDistance: null,
    };
    const detail = {
      ...mlbFinalDetail,
      plays: [...mlbFinalDetail.plays, nonScoringPlay],
    };

    render(<MlbFinalPlayFeed detail={detail} />);
    await user.click(screen.getByRole("button", { name: /all plays/i }));

    expect(screen.getByText("Smith strikes out swinging")).toBeInTheDocument();
  });

  it("groups all plays from one half inning in an away-colored card", async () => {
    const user = userEvent.setup();
    const firstTopInningPlay = {
      ...mlbFinalDetail.plays[0],
      id: "p-top-4-1",
      inning: 4,
      half: "top" as const,
      text: "Marte singles",
      scoring: false,
      scoringTeam: null,
    };
    const secondTopInningPlay = {
      ...firstTopInningPlay,
      id: "p-top-4-2",
      text: "Carroll walks",
    };
    const detail = {
      ...mlbFinalDetail,
      plays: [firstTopInningPlay, secondTopInningPlay],
    };

    render(<MlbFinalPlayFeed detail={detail} />);
    await user.click(screen.getByRole("button", { name: /all plays/i }));

    const halfInningCard = screen.getByTestId("mlb-play-half-top-4");
    expect(halfInningCard).toHaveStyle({
      backgroundColor: mlbFinalDetail.away.color,
    });
    expect(screen.getAllByText("Top 4th")).toHaveLength(1);
    expect(halfInningCard).toHaveTextContent("Marte singles");
    expect(halfInningCard).toHaveTextContent("Carroll walks");
  });

  it("hides the metrics row when a play has no Statcast data", () => {
    const detail = {
      ...mlbFinalDetail,
      plays: [
        {
          ...mlbFinalDetail.plays[0],
          exitVelo: null,
          launchAngle: null,
          totalDistance: null,
        },
      ],
      scoringPlays: [
        {
          ...mlbFinalDetail.scoringPlays[0],
          exitVelo: null,
          launchAngle: null,
          totalDistance: null,
        },
      ],
    };

    render(<MlbFinalPlayFeed detail={detail} />);

    expect(screen.queryByText(/mph/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ft/)).not.toBeInTheDocument();
    expect(screen.queryByText(/°/)).not.toBeInTheDocument();
  });
});
