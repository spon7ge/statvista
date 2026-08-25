import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MlbWinProbability } from "./MlbWinProbability";
import { mlbLiveDetail } from "../lib/testFixtures";
import type { MlbWinProbability as MlbWinProbabilityData } from "../lib/types";

describe("MlbWinProbability", () => {
  it("shows unavailable message when win probability is null", () => {
    render(
      <MlbWinProbability
        detail={{ ...mlbLiveDetail, winProbability: null }}
      />,
    );
    expect(screen.getByText("Game flow")).toBeInTheDocument();
    expect(
      screen.getByText("Win probability unavailable"),
    ).toBeInTheDocument();
  });

  it("renders a chart when win probability points are present", () => {
    render(<MlbWinProbability detail={mlbLiveDetail} />);
    expect(screen.getByText("Game flow")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Win probability chart"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Win probability unavailable"),
    ).not.toBeInTheDocument();
  });

  it("shows white enlarged team abbrev + pct labels", () => {
    render(<MlbWinProbability detail={mlbLiveDetail} />);
    const home = screen.getByTestId("mlb-game-flow-home-pct");
    const away = screen.getByTestId("mlb-game-flow-away-pct");
    expect(home).toHaveAttribute("fill", "#FFFFFF");
    expect(away).toHaveAttribute("fill", "#FFFFFF");
    expect(home).toHaveStyle({ fontSize: "18px" });
    expect(away).toHaveStyle({ fontSize: "18px" });
  });

  it("keeps home and away pct labels vertically separated when lines cross", () => {
    render(
      <MlbWinProbability
        detail={{
          ...mlbLiveDetail,
          winProbability: {
            awayAbbrev: mlbLiveDetail.away.abbrev,
            homeAbbrev: mlbLiveDetail.home.abbrev,
            points: [
              { playId: "cross", label: "Bot 5", homeWinPct: 0.5 },
            ],
            stakes: null,
          },
        }}
      />,
    );
    const home = screen.getByTestId("mlb-game-flow-home-pct");
    const away = screen.getByTestId("mlb-game-flow-away-pct");
    const homeY = Number(home.getAttribute("y"));
    const awayY = Number(away.getAttribute("y"));
    expect(Math.abs(homeY - awayY)).toBeGreaterThanOrEqual(22);
  });

  it("uses compact viewBox height when compact is set", () => {
    render(<MlbWinProbability detail={mlbLiveDetail} compact />);
    expect(screen.getByLabelText("Win probability chart")).toHaveAttribute(
      "viewBox",
      "0 0 640 168",
    );
  });

  it("uses default viewBox height without compact", () => {
    render(<MlbWinProbability detail={mlbLiveDetail} />);
    expect(screen.getByLabelText("Win probability chart")).toHaveAttribute(
      "viewBox",
      "0 0 640 520",
    );
  });

  it("adds a neon halo on each team line when the game is live", () => {
    const { container } = render(
      <MlbWinProbability detail={mlbLiveDetail} />,
    );

    const neon = container.querySelectorAll("[data-wp-segment='neon']");
    expect(neon).toHaveLength(2);
    neon.forEach((el) => {
      expect(el.getAttribute("filter")).toMatch(/wp-neon/);
    });
  });

  it("adds a neon halo on each team line when the game is final", () => {
    const { container } = render(
      <MlbWinProbability detail={{ ...mlbLiveDetail, status: "final" }} />,
    );

    expect(container.querySelectorAll("[data-wp-segment='neon']")).toHaveLength(
      2,
    );
  });

  it("adds a neon halo at halftime", () => {
    const { container } = render(
      <MlbWinProbability
        detail={{ ...mlbLiveDetail, status: "halftime" }}
      />,
    );

    expect(container.querySelectorAll("[data-wp-segment='neon']")).toHaveLength(
      2,
    );
  });

  it("does not neon the team lines when the game is scheduled", () => {
    const { container } = render(
      <MlbWinProbability
        detail={{ ...mlbLiveDetail, status: "scheduled" }}
      />,
    );

    expect(container.querySelectorAll("[data-wp-segment='neon']")).toHaveLength(
      0,
    );
  });

  it("does not neon muted future path segments", () => {
    const winProbability: MlbWinProbabilityData = {
      awayAbbrev: mlbLiveDetail.away.abbrev,
      homeAbbrev: mlbLiveDetail.home.abbrev,
      points: [
        { playId: "p1", label: "Top 1", homeWinPct: 0.44 },
        { playId: "p2", label: "Top 3", homeWinPct: 0.48 },
      ],
      stakes: null,
    };
    const { container } = render(
      <MlbWinProbability detail={{ ...mlbLiveDetail, winProbability }} />,
    );
    fireEvent.change(
      screen.getByRole("slider", { name: /win probability timeline/i }),
      { target: { value: "0" } },
    );

    const muted = container.querySelectorAll("[data-wp-segment='muted']");
    expect(muted.length).toBeGreaterThanOrEqual(2);
    muted.forEach((el) => {
      expect(el.getAttribute("filter")).toBeNull();
    });
  });
});
