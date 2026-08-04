import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbFinalCenter } from "./MlbFinalCenter";
import { mlbFinalDetail } from "./testFixtures";

describe("MlbFinalCenter", () => {
  it("renders Summary by default and keeps charts below tab content", async () => {
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
    expect(screen.queryByTestId("mlb-box-score")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /box/i }));

    expect(screen.getByTestId("mlb-box-score")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-box-score-layout")).toHaveClass(
      "grid-cols-2",
    );
    expect(screen.queryByTestId("mlb-final-play-feed")).not.toBeInTheDocument();
  });
});
