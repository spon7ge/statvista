import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  genericWallRadiusFt,
  hitPointTooltip,
  MlbHitChart,
} from "./MlbHitChart";
import { mlbLiveDetail } from "../lib/testFixtures";
import type { MlbHitPoint } from "../lib/types";

const hitPoints: MlbHitPoint[] = [
  {
    id: "h1",
    team: "away",
    playerName: "Betts",
    result: "hit",
    outcome: "Single",
    x: 0.4,
    y: 0.5,
  },
  {
    id: "h2",
    team: "home",
    playerName: "Freeman",
    result: "hr",
    outcome: "HR",
    x: 0.6,
    y: 0.3,
  },
  {
    id: "h3",
    team: "away",
    playerName: "Devers",
    result: "out",
    outcome: "Flyout",
    x: 0.5,
    y: 0.7,
  },
];

describe("genericWallRadiusFt", () => {
  it("is deepest near center field and ~330 at the foul poles", () => {
    expect(genericWallRadiusFt(90)).toBeGreaterThan(400);
    expect(genericWallRadiusFt(45)).toBeGreaterThan(320);
    expect(genericWallRadiusFt(45)).toBeLessThan(340);
    expect(genericWallRadiusFt(135)).toBeGreaterThan(320);
    expect(genericWallRadiusFt(135)).toBeLessThan(340);
  });
});

describe("MlbHitChart infield visual scale", () => {
  it("draws an enlarged perfect-square dirt diamond", () => {
    render(
      <MlbHitChart detail={{ ...mlbLiveDetail, hitChart: hitPoints }} />,
    );
    const field = screen.getByTestId("mlb-hit-chart-field");
    const dirt = field.querySelector("path[fill='#6e5538']");
    const d = dirt?.getAttribute("d") ?? "";
    // Corners equally spaced from center: home/2nd on x=160, 1st/3rd on shared y.
    expect(d).toMatch(/^M160\.00 [\d.]+ L[\d.]+ [\d.]+ L160\.00 [\d.]+ L[\d.]+ [\d.]+ Z$/);
    const nums = [...d.matchAll(/[\d.]+/g)].map(Number);
    const [hx, hy, fx, fy, sx, sy, tx, ty] = nums;
    expect(hx).toBeCloseTo(sx!, 1);
    expect(fy).toBeCloseTo(ty!, 1);
    expect(Math.abs(fx! - hx!)).toBeCloseTo(Math.abs(hy! - fy!), 1);
    expect(Math.abs(sy! - fy!)).toBeCloseTo(Math.abs(hy! - fy!), 1);
  });

  it("draws a green perfect-square grass box inside the dirt diamond", () => {
    render(
      <MlbHitChart detail={{ ...mlbLiveDetail, hitChart: hitPoints }} />,
    );
    const grass = screen.getByTestId("mlb-hit-chart-infield-grass");
    expect(grass).toHaveAttribute("fill", "#2f6b3d");
    const d = grass.getAttribute("d") ?? "";
    const nums = [...d.matchAll(/[\d.]+/g)].map(Number);
    const [hx, hy, fx, fy, sx, sy, tx, ty] = nums;
    expect(hx).toBeCloseTo(sx!, 1);
    expect(fy).toBeCloseTo(ty!, 1);
    expect(Math.abs(fx! - hx!)).toBeCloseTo(Math.abs(hy! - fy!), 1);
    expect(Math.abs(sy! - fy!)).toBeCloseTo(Math.abs(hy! - fy!), 1);
  });

  it("formats hover tooltip as player name + outcome · team abbrev", () => {
    expect(hitPointTooltip(hitPoints[0]!, "BOS")).toEqual({
      name: "Betts",
      detail: "Single · BOS",
    });
    expect(hitPointTooltip(hitPoints[1]!, "LAD")).toEqual({
      name: "Freeman",
      detail: "HR · LAD",
    });
  });

  it("shows player, outcome, and team abbrev on hover", async () => {
    const user = userEvent.setup();
    render(
      <MlbHitChart detail={{ ...mlbLiveDetail, hitChart: hitPoints }} />,
    );
    await user.hover(screen.getByTestId("mlb-hit-point-h1"));
    const tip = await screen.findByTestId("mlb-hit-chart-tooltip");
    expect(tip).toHaveTextContent("Betts");
    expect(tip).toHaveTextContent("Single · BOS");
  });
});
describe("MlbHitChart", () => {
  it("shows empty copy, legend, wall caption, and team-abbrev filters", () => {
    render(<MlbHitChart detail={{ ...mlbLiveDetail, hitChart: [] }} />);
    expect(screen.getByText("Hit chart")).toBeInTheDocument();
    expect(screen.getByText("No hit chart data yet")).toBeInTheDocument();
    expect(screen.getByText("HR")).toBeInTheDocument();
    expect(screen.getByText("Hit")).toBeInTheDocument();
    expect(screen.getByText("Out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "BOS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LAD" })).toBeInTheDocument();
    expect(
      screen.getByText(/shaded ring past it is home-run territory/i),
    ).toBeInTheDocument();
  });

  it("filters points by Both / team abbrevs and draws polar wall + HR ring", async () => {
    const user = userEvent.setup();
    render(
      <MlbHitChart detail={{ ...mlbLiveDetail, hitChart: hitPoints }} />,
    );

    expect(screen.getByTestId("mlb-hit-chart-wall")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-chart-hr-ring")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-chart-field")).toBeInTheDocument();

    expect(screen.getByTestId("mlb-hit-point-h1")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-point-h2")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-point-h3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "BOS" }));
    expect(screen.getByTestId("mlb-hit-point-h1")).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-hit-point-h2")).not.toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-point-h3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "LAD" }));
    expect(screen.queryByTestId("mlb-hit-point-h1")).not.toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-point-h2")).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-hit-point-h3")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Both" }));
    expect(screen.getByTestId("mlb-hit-point-h1")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-point-h2")).toBeInTheDocument();
  });
});
