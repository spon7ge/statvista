import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MlbOddsBookBoardView } from "../lib/mlbOddsBoard";
import { MlbGameOddsBoard } from "./MlbGameOddsBoard";
import { mlbScheduledDetail } from "../lib/testFixtures";

function makeBoard(
  sportsbook: string,
  overrides: Partial<MlbOddsBookBoardView> = {},
): MlbOddsBookBoardView {
  return {
    sportsbook,
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
    ...overrides,
  };
}

describe("MlbGameOddsBoard", () => {
  it("renders unavailable when boards is empty", () => {
    render(<MlbGameOddsBoard detail={mlbScheduledDetail} boards={[]} />);

    expect(screen.getByTestId("mlb-game-odds-board")).toBeInTheDocument();
    expect(screen.getByText("Odds unavailable")).toBeInTheDocument();
  });

  it("renders loading while odds are pending", () => {
    render(
      <MlbGameOddsBoard detail={mlbScheduledDetail} boards={[]} isPending />,
    );

    expect(screen.getByText("Loading odds…")).toBeInTheDocument();
    expect(screen.queryByText("Odds unavailable")).not.toBeInTheDocument();
  });

  it("labels Money Total Spread and shows bookmaker under each pair", () => {
    render(
      <MlbGameOddsBoard
        detail={mlbScheduledDetail}
        boards={[makeBoard("pinnacle")]}
      />,
    );

    expect(screen.getByText("Money")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Spread")).toBeInTheDocument();
    expect(screen.queryByText("Bookmaker")).not.toBeInTheDocument();
    expect(screen.getByTestId("mlb-odds-book-pinnacle")).toHaveTextContent(
      "Pinnacle",
    );
    expect(screen.getByText("+113")).toBeInTheDocument();
    expect(screen.getByText("-115")).toBeInTheDocument();
  });

  it("stacks multiple books with a subtle book label under each pair", () => {
    render(
      <MlbGameOddsBoard
        detail={mlbScheduledDetail}
        boards={[makeBoard("prophetx"), makeBoard("novig")]}
      />,
    );

    expect(screen.getByTestId("mlb-odds-book-prophetx")).toHaveTextContent(
      "ProphetX",
    );
    expect(screen.getByTestId("mlb-odds-book-novig")).toHaveTextContent(
      "Novig",
    );
  });

  it("renders money, total, and spread tiles from the board", () => {
    render(
      <MlbGameOddsBoard
        detail={mlbScheduledDetail}
        boards={[makeBoard("pinnacle")]}
      />,
    );

    expect(screen.getByText("+113")).toBeInTheDocument();
    expect(screen.getByText("o7.5")).toBeInTheDocument();
    expect(screen.getByText("u7.5")).toBeInTheDocument();
    expect(screen.getByText("+1.5")).toBeInTheDocument();
    expect(screen.getByText("-1.5")).toBeInTheDocument();
    expect(screen.getByText("-113")).toBeInTheDocument();
    expect(screen.getByText("-182")).toBeInTheDocument();
    expect(screen.getByText("WSH")).toBeInTheDocument();
    expect(screen.getByText("PHI")).toBeInTheDocument();
  });

  it("shows asOf in the header without a sportsbook label", () => {
    render(
      <MlbGameOddsBoard
        detail={mlbScheduledDetail}
        boards={[makeBoard("pinnacle")]}
      />,
    );

    const header = screen.getByRole("heading", { name: "Odds" }).parentElement;
    expect(header?.textContent).toMatch(/\d/);
    expect(header?.textContent).not.toMatch(/Pinnacle/);
    expect(screen.getByTestId("mlb-odds-book-pinnacle")).toBeInTheDocument();
  });

  it("shows the line and dashes only the price when the price is missing", () => {
    render(
      <MlbGameOddsBoard
        detail={mlbScheduledDetail}
        boards={[
          makeBoard("pinnacle", {
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
          }),
        ]}
      />,
    );

    expect(screen.getByText("o8.5")).toBeInTheDocument();
    expect(screen.getByText("u8.5")).toBeInTheDocument();
    expect(screen.getByText("-1.5")).toBeInTheDocument();
    expect(screen.getByText("+1.5")).toBeInTheDocument();
    // 2 money primary dashes + 4 total/spread secondary price dashes
    expect(screen.getAllByText("–")).toHaveLength(6);
    expect(screen.getByTestId("mlb-odds-book-pinnacle")).toHaveTextContent(
      "Pinnacle",
    );
  });

  it("renders a dash for missing odds", () => {
    render(
      <MlbGameOddsBoard
        detail={mlbScheduledDetail}
        boards={[
          makeBoard("pinnacle", {
            sportsbook: "pinnacle",
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
          }),
        ]}
      />,
    );

    // 2 money primary + 4 total/spread primary + 4 total/spread secondary
    expect(screen.getAllByText("–")).toHaveLength(10);
  });
});
