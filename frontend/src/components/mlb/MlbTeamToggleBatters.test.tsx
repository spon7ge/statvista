import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbTeamToggleBatters } from "./MlbTeamToggleBatters";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbTeamToggleBatters", () => {
  it("defaults to away batters when inningHalf is top", () => {
    render(<MlbTeamToggleBatters detail={mlbLiveDetail} />);
    expect(screen.getByTestId("mlb-team-toggle-batters")).toBeInTheDocument();
    expect(screen.getByText("Betts")).toBeInTheDocument();
    expect(screen.queryByText("Freeman")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sox" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("defaults to home batters when inningHalf is bottom", () => {
    render(
      <MlbTeamToggleBatters
        detail={{
          ...mlbLiveDetail,
          linescore: {
            ...mlbLiveDetail.linescore!,
            inningHalf: "bottom",
          },
        }}
      />,
    );
    expect(screen.getByText("Freeman")).toBeInTheDocument();
    expect(screen.queryByText("Betts")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dodgers" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("toggle switches visible team name and rows", async () => {
    const user = userEvent.setup();
    render(<MlbTeamToggleBatters detail={mlbLiveDetail} />);

    expect(screen.getByText("Betts")).toBeInTheDocument();
    expect(screen.queryByText("Freeman")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dodgers" }));
    expect(screen.getByText("Freeman")).toBeInTheDocument();
    expect(screen.queryByText("Betts")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dodgers" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Sox" }));
    expect(screen.getByText("Betts")).toBeInTheDocument();
    expect(screen.queryByText("Freeman")).not.toBeInTheDocument();
  });

  it("renders AB R H RBI HR SB BB K columns with hr and sb values", () => {
    render(<MlbTeamToggleBatters detail={mlbLiveDetail} />);
    for (const col of ["AB", "R", "H", "RBI", "HR", "SB", "BB", "K"]) {
      expect(screen.getByText(col)).toBeInTheDocument();
    }
    const row = screen.getByText("Betts").closest("li");
    expect(row).toHaveTextContent("2");
    expect(row).toHaveTextContent("1");
  });

  it("returns null when box score is missing", () => {
    const { container } = render(
      <MlbTeamToggleBatters detail={{ ...mlbLiveDetail, boxScore: null }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("survives boxScore null then populated without crashing", () => {
    const { rerender } = render(
      <MlbTeamToggleBatters detail={{ ...mlbLiveDetail, boxScore: null }} />,
    );
    expect(screen.queryByTestId("mlb-team-toggle-batters")).not.toBeInTheDocument();

    rerender(<MlbTeamToggleBatters detail={mlbLiveDetail} />);
    expect(screen.getByTestId("mlb-team-toggle-batters")).toBeInTheDocument();
    expect(screen.getByText("Betts")).toBeInTheDocument();
  });
});
