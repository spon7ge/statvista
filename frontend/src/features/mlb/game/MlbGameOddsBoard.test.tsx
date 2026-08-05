import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MlbGameOddsBoard } from "./MlbGameOddsBoard";
import { mlbScheduledDetail } from "../lib/testFixtures";

describe("MlbGameOddsBoard", () => {
  it("renders unavailable when view is null", () => {
    render(<MlbGameOddsBoard detail={mlbScheduledDetail} view={null} />);

    expect(screen.getByTestId("mlb-game-odds-board")).toBeInTheDocument();
    expect(screen.getByText("Odds unavailable")).toBeInTheDocument();
  });

  it("renders loading while odds are pending", () => {
    render(<MlbGameOddsBoard detail={mlbScheduledDetail} view={null} isPending />);

    expect(screen.getByText("Loading odds…")).toBeInTheDocument();
    expect(screen.queryByText("Odds unavailable")).not.toBeInTheDocument();
  });

  it("renders money, total, and spread tiles from the view", () => {
    render(
      <MlbGameOddsBoard
        detail={mlbScheduledDetail}
        view={{
          sportsbook: "pinnacle",
          asOf: "2026-08-05T18:00:00Z",
          rows: [
            {
              side: "away",
              money: { kind: "money", price: 113 },
              total: { kind: "total", side: "over", line: 7.5, price: -113 },
              spread: { kind: "spread", line: 1.5, price: -182 },
            },
            {
              side: "home",
              money: { kind: "money", price: -115 },
              total: { kind: "total", side: "under", line: 7.5, price: 108 },
              spread: { kind: "spread", line: -1.5, price: 174 },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("+113")).toBeInTheDocument();
    expect(screen.getByText("o7.5")).toBeInTheDocument();
    expect(screen.getByText("u7.5")).toBeInTheDocument();
    expect(screen.getByText("+1.5")).toBeInTheDocument();
    expect(screen.getByText("-1.5")).toBeInTheDocument();
    expect(screen.getByText("WSH")).toBeInTheDocument();
    expect(screen.getByText("PHI")).toBeInTheDocument();
    expect(screen.getByText(/Pinnacle/)).toBeInTheDocument();
  });

  it("shows the line and dashes only the price when the price is missing", () => {
    render(
      <MlbGameOddsBoard
        detail={mlbScheduledDetail}
        view={{
          sportsbook: "draftkings",
          asOf: null,
          rows: [
            {
              side: "away",
              money: { kind: "money", price: null },
              total: { kind: "total", side: "over", line: 8.5, price: null },
              spread: { kind: "spread", line: -1.5, price: null },
            },
            {
              side: "home",
              money: { kind: "money", price: null },
              total: { kind: "total", side: "under", line: 8.5, price: null },
              spread: { kind: "spread", line: 1.5, price: null },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("o8.5")).toBeInTheDocument();
    expect(screen.getByText("u8.5")).toBeInTheDocument();
    expect(screen.getByText("-1.5")).toBeInTheDocument();
    expect(screen.getByText("+1.5")).toBeInTheDocument();
    // Two moneylines plus one dash beside each of the four priced-less lines.
    expect(screen.getAllByText("–")).toHaveLength(6);
    expect(screen.getByText(/DraftKings/)).toBeInTheDocument();
  });

  it("renders a dash for missing odds", () => {
    render(
      <MlbGameOddsBoard
        detail={mlbScheduledDetail}
        view={{
          sportsbook: null,
          asOf: null,
          rows: [
            {
              side: "away",
              money: { kind: "money", price: null },
              total: { kind: "total", side: "over", line: null, price: null },
              spread: { kind: "spread", line: null, price: null },
            },
            {
              side: "home",
              money: { kind: "money", price: null },
              total: { kind: "total", side: "under", line: null, price: null },
              spread: { kind: "spread", line: null, price: null },
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("–")).toHaveLength(6);
  });
});
