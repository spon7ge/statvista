import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { genericWallRadiusFt, MlbHitChart } from "./MlbHitChart";
import { mlbLiveDetail } from "../lib/testFixtures";
import type { MlbHitPoint } from "../lib/types";

const hitPoints: MlbHitPoint[] = [
  {
    id: "h1",
    team: "away",
    playerName: "Betts",
    result: "hit",
    x: 0.4,
    y: 0.5,
  },
  {
    id: "h2",
    team: "home",
    playerName: "Freeman",
    result: "hr",
    x: 0.6,
    y: 0.3,
  },
  {
    id: "h3",
    team: "away",
    playerName: "Devers",
    result: "out",
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
