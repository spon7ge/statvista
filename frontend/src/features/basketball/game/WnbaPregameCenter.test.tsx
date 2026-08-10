import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildScheduledDetail } from "../lib/testFixtures";
import { WnbaPregameCenter } from "./WnbaPregameCenter";

const scheduledWithPreview = buildScheduledDetail({
  matchupPrediction: {
    awayWinPct: 67,
    homeWinPct: 33,
    sourceLabel: "ESPN game projection",
  },
  projectedStarters: {
    note: "from each team's last game",
    away: [
      { jersey: "1", name: "Natasha Howard", position: "F", gtd: false },
    ],
    home: [
      { jersey: "10", name: "Maria Conde", position: "F", gtd: false },
    ],
  },
  seasonLeaders: {
    away: [
      { stat: "points", label: "Points", name: "Player A", value: "20.1" },
    ],
    home: [
      { stat: "points", label: "Points", name: "Player B", value: "18.5" },
    ],
  },
  injuries: {
    away: [],
    home: [],
  },
});

describe("WnbaPregameCenter", () => {
  it("renders broadcast chrome with null scores and no Summary|Box tabs", () => {
    render(<WnbaPregameCenter detail={scheduledWithPreview} />);

    expect(screen.getByTestId("wnba-pregame-center")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-broadcast-header")).toBeInTheDocument();
    expect(screen.getByText(scheduledWithPreview.statusLabel)).toBeInTheDocument();
    expect(screen.getAllByText("–")).toHaveLength(2);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /summary/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^box$/i })).not.toBeInTheDocument();
  });

  it("stacks matchup preview sections under the header", () => {
    render(<WnbaPregameCenter detail={scheduledWithPreview} />);

    expect(screen.getByText(/Matchup prediction/i)).toBeInTheDocument();
    expect(screen.getByText(/Projected starters/i)).toBeInTheDocument();
    expect(screen.getByText("Natasha Howard")).toBeInTheDocument();
    expect(screen.getByText("Maria Conde")).toBeInTheDocument();
    expect(screen.getByText(/Season leaders/i)).toBeInTheDocument();
    expect(screen.queryByText(/Shot chart/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("wnba-play-feed")).not.toBeInTheDocument();
  });
});
