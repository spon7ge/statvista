import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbHitChart } from "./MlbHitChart";
import { mlbLiveDetail } from "./testFixtures";
import type { MlbHitPoint } from "./types";

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

describe("MlbHitChart", () => {
  it("shows muted empty copy when there are no hit points", () => {
    render(<MlbHitChart detail={{ ...mlbLiveDetail, hitChart: [] }} />);
    expect(screen.getByText("Hit chart")).toBeInTheDocument();
    expect(screen.getByText("No hit chart data yet")).toBeInTheDocument();
    expect(screen.getByText("HR")).toBeInTheDocument();
    expect(screen.getByText("Hit")).toBeInTheDocument();
    expect(screen.getByText("Out")).toBeInTheDocument();
  });

  it("filters points by Both / away / home", async () => {
    const user = userEvent.setup();
    render(
      <MlbHitChart detail={{ ...mlbLiveDetail, hitChart: hitPoints }} />,
    );

    expect(screen.getByTestId("mlb-hit-point-h1")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-point-h2")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-point-h3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Away" }));
    expect(screen.getByTestId("mlb-hit-point-h1")).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-hit-point-h2")).not.toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-point-h3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(screen.queryByTestId("mlb-hit-point-h1")).not.toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-point-h2")).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-hit-point-h3")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Both" }));
    expect(screen.getByTestId("mlb-hit-point-h1")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-point-h2")).toBeInTheDocument();
  });
});
