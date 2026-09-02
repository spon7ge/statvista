import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WinProbabilityPanel } from "./WinProbabilityPanel";
import { buildGameDetailFixture } from "../lib/testFixtures";
import type {
  GameDetailWinProbability,
  GameDetailWinProbabilityPoint,
} from "../lib/types";

function buildDenseTimeline(count: number): GameDetailWinProbabilityPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `wp-${index}`,
    period: 1,
    clock: `${Math.max(0, 10 - Math.floor(index / 40))}:${String(index % 60).padStart(2, "0")}`,
    awayScore: index,
    homeScore: Math.max(0, index - 1),
    awayWinPct: 50,
    homeWinPct: 50,
    teamId: "home1",
  }));
}

describe("WinProbabilityPanel", () => {
  it("renders a chart-first Game flow module without nested team stats", () => {
    render(<WinProbabilityPanel detail={buildGameDetailFixture()} />);

    expect(screen.getByTestId("wnba-game-flow")).toBeInTheDocument();
    expect(screen.getByText("Game flow")).toBeInTheDocument();
    expect(screen.getByLabelText("Win probability chart")).toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    expect(screen.queryByText("Team stats")).not.toBeInTheDocument();
    expect(screen.queryByText("Field goal %")).not.toBeInTheDocument();
  });

  it("renders dual on-chart labels for the latest point", () => {
    render(<WinProbabilityPanel detail={buildGameDetailFixture()} />);

    expect(screen.queryByText(/Above the midline favors/)).not.toBeInTheDocument();
    expect(screen.queryByText("GS 10–8 PHX")).not.toBeInTheDocument();

    const chart = screen.getByLabelText("Win probability chart");
    expect(chart).toHaveTextContent("PHX");
    expect(chart).toHaveTextContent("54%");
    expect(chart).toHaveTextContent("GS");
    expect(chart).toHaveTextContent("46%");
    expect(chart).toHaveTextContent("Q1 4:29");
  });

  it("keeps home and away % labels vertically separated when win pcts are close", () => {
    const winProbability: GameDetailWinProbability = {
      summary: null,
      timeline: [
        {
          id: "wp-close",
          period: 2,
          clock: "5:00",
          awayScore: 40,
          homeScore: 41,
          awayWinPct: 49,
          homeWinPct: 51,
          teamId: "home1",
        },
      ],
      teamStats: [],
    };

    render(
      <WinProbabilityPanel
        detail={buildGameDetailFixture({ winProbability })}
      />,
    );

    const home = screen.getByTestId("wnba-game-flow-home-pct");
    const away = screen.getByTestId("wnba-game-flow-away-pct");
    const homeY = Number(home.getAttribute("y"));
    const awayY = Number(away.getAttribute("y"));
    expect(Math.abs(homeY - awayY)).toBeGreaterThanOrEqual(22);
  });

  it("updates on-chart labels when pointer moves near an earlier timeline point", () => {
    const { container } = render(
      <WinProbabilityPanel detail={buildGameDetailFixture()} />,
    );
    const chart = container.querySelector("svg");
    expect(chart).not.toBeNull();
    chart!.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 640,
        height: 112,
        right: 640,
        bottom: 112,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.mouseMove(chart!, { clientX: 40, clientY: 110 });

    expect(chart).toHaveTextContent("44%");
    expect(chart).toHaveTextContent("56%");
    expect(chart).toHaveTextContent("Q1 8:00");
    expect(chart).not.toHaveTextContent("54%");
  });

  it("lets keyboard users step away from the latest point via a single slider", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WinProbabilityPanel detail={buildGameDetailFixture()} />,
    );

    const slider = screen.getByRole("slider", {
      name: /win probability timeline/i,
    });
    await user.tab();
    expect(slider).toHaveFocus();

    fireEvent.change(slider, { target: { value: "0" } });

    const chart = container.querySelector("svg");
    expect(chart).toHaveTextContent("44%");
    expect(chart).toHaveTextContent("56%");
    expect(chart).toHaveTextContent("Q1 8:00");
    expect(chart).not.toHaveTextContent("54%");
    expect(screen.queryByText("GS 2–0 PHX")).not.toBeInTheDocument();
  });

  it("renders muted future path segments when scrub is not at the end", () => {
    const { container } = render(
      <WinProbabilityPanel detail={buildGameDetailFixture()} />,
    );
    const slider = screen.getByRole("slider", {
      name: /win probability timeline/i,
    });
    fireEvent.change(slider, { target: { value: "0" } });

    const muted = container.querySelectorAll("[data-wp-segment='muted']");
    expect(muted.length).toBeGreaterThanOrEqual(2);
    muted.forEach((el) => {
      expect(el.getAttribute("stroke")).toBe("var(--text-muted)");
    });
  });

  it("does not create a focusable marker for every dense timeline point", () => {
    const winProbability: GameDetailWinProbability = {
      summary: null,
      timeline: buildDenseTimeline(400),
      teamStats: [],
    };

    render(
      <WinProbabilityPanel
        detail={buildGameDetailFixture({ winProbability })}
      />,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getAllByRole("slider")).toHaveLength(1);
  });

  it("renders timeline-only data without team stats", () => {
    const winProbability: GameDetailWinProbability = {
      summary: null,
      timeline: [
        {
          id: "wp-1",
          period: 1,
          clock: "8:00",
          awayScore: 2,
          homeScore: 0,
          awayWinPct: 56,
          homeWinPct: 44,
          teamId: "away1",
        },
      ],
      teamStats: [],
    };

    render(
      <WinProbabilityPanel
        detail={buildGameDetailFixture({ winProbability })}
      />,
    );

    const chart = screen.getByLabelText("Win probability chart");
    expect(chart).toHaveTextContent("PHX");
    expect(chart).toHaveTextContent("44%");
    expect(chart).toHaveTextContent("GS");
    expect(chart).toHaveTextContent("56%");
    expect(
      screen.getByRole("slider", { name: /win probability timeline/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Field goal %")).not.toBeInTheDocument();
  });

  it("shows an unavailable message when win probability data is missing", () => {
    render(
      <WinProbabilityPanel
        detail={buildGameDetailFixture({ winProbability: null })}
      />,
    );

    expect(screen.getByText("Win probability unavailable")).toBeInTheDocument();
  });

  it("shows unavailable when timeline is empty even if teamStats exist", () => {
    render(
      <WinProbabilityPanel
        detail={buildGameDetailFixture({
          winProbability: {
            ...buildGameDetailFixture().winProbability!,
            timeline: [],
          },
        })}
      />,
    );

    expect(screen.getByText("Game flow")).toBeInTheDocument();
    expect(screen.getByText("Win probability unavailable")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Win probability chart"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Field goal %")).not.toBeInTheDocument();
  });

  it("wraps content in the quiet GameSection surface", () => {
    render(<WinProbabilityPanel detail={buildGameDetailFixture()} />);
    const heading = screen.getByRole("heading", { name: /game flow/i });
    expect(heading.closest("section")).toHaveClass(
      "rounded",
      "bg-c2",
      "!p-3",
    );
    expect(heading.closest("section")).toHaveClass("border-line");
  });

  it("does not draw neon glow on game-flow lines", () => {
    const { container } = render(
      <WinProbabilityPanel detail={buildGameDetailFixture({ status: "live" })} />,
    );

    expect(container.querySelectorAll("[data-wp-segment='neon']")).toHaveLength(0);
  });

  it("does not neon the team lines when the game is scheduled", () => {
    const { container } = render(
      <WinProbabilityPanel
        detail={buildGameDetailFixture({ status: "scheduled" })}
      />,
    );

    expect(container.querySelectorAll("[data-wp-segment='neon']")).toHaveLength(0);
  });

  it("does not neon muted future path segments", () => {
    const { container } = render(
      <WinProbabilityPanel detail={buildGameDetailFixture()} />,
    );
    fireEvent.change(
      screen.getByRole("slider", { name: /win probability timeline/i }),
      { target: { value: "0" } },
    );

    const muted = container.querySelectorAll("[data-wp-segment='muted']");
    expect(muted.length).toBeGreaterThanOrEqual(2);
    muted.forEach((el) => {
      expect(el.getAttribute("data-wp-segment")).toBe("muted");
      expect(el.getAttribute("filter")).toBeNull();
    });
  });
});
