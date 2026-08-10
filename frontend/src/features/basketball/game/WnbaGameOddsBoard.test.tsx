import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WnbaOddsBookBoardView } from "../lib/wnbaOddsBoard";
import { buildScheduledDetail } from "../lib/testFixtures";
import { WnbaGameOddsBoard } from "./WnbaGameOddsBoard";

const detail = buildScheduledDetail();

function makeBoard(
  sportsbook: string,
  overrides: Partial<WnbaOddsBookBoardView> = {},
): WnbaOddsBookBoardView {
  return {
    sportsbook,
    asOf: "2026-08-10T18:00:00Z",
    rows: [
      {
        side: "away",
        money: { kind: "money", price: 165 },
        total: { kind: "total", side: "over", line: 162.5, price: null },
        spread: { kind: "spread", line: 4.5, price: null },
      },
      {
        side: "home",
        money: { kind: "money", price: -195 },
        total: { kind: "total", side: "under", line: 162.5, price: null },
        spread: { kind: "spread", line: -4.5, price: null },
      },
    ],
    ...overrides,
  };
}

describe("WnbaGameOddsBoard", () => {
  it("renders unavailable when boards is empty", () => {
    render(<WnbaGameOddsBoard detail={detail} boards={[]} />);

    expect(screen.getByTestId("wnba-game-odds-board")).toBeInTheDocument();
    expect(screen.getByText("Odds unavailable")).toBeInTheDocument();
  });

  it("renders loading while odds are pending", () => {
    render(<WnbaGameOddsBoard detail={detail} boards={[]} isPending />);

    expect(screen.getByText("Loading odds…")).toBeInTheDocument();
    expect(screen.queryByText("Odds unavailable")).not.toBeInTheDocument();
  });

  it("labels Money Total Spread and shows bookmaker under each pair", () => {
    render(
      <WnbaGameOddsBoard detail={detail} boards={[makeBoard("pinnacle")]} />,
    );

    expect(screen.getByText("Money")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Spread")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-odds-book-pinnacle")).toHaveTextContent(
      "Pinnacle",
    );
    expect(screen.getByText("+165")).toBeInTheDocument();
    expect(screen.getByText("-195")).toBeInTheDocument();
  });

  it("stacks multiple books with a subtle book label under each pair", () => {
    render(
      <WnbaGameOddsBoard
        detail={detail}
        boards={[makeBoard("pinnacle"), makeBoard("draftkings")]}
      />,
    );

    expect(screen.getByTestId("wnba-odds-book-pinnacle")).toHaveTextContent(
      "Pinnacle",
    );
    expect(screen.getByTestId("wnba-odds-book-draftkings")).toHaveTextContent(
      "DraftKings",
    );
  });

  it("renders money, total, and spread tiles from the board", () => {
    render(
      <WnbaGameOddsBoard detail={detail} boards={[makeBoard("pinnacle")]} />,
    );

    expect(screen.getByText("+165")).toBeInTheDocument();
    expect(screen.getByText("o162.5")).toBeInTheDocument();
    expect(screen.getByText("u162.5")).toBeInTheDocument();
    expect(screen.getByText("+4.5")).toBeInTheDocument();
    expect(screen.getByText("-4.5")).toBeInTheDocument();
    expect(screen.getByText("MIN")).toBeInTheDocument();
    expect(screen.getByText("TOR")).toBeInTheDocument();
  });

  it("shows asOf in the header without a sportsbook label", () => {
    render(
      <WnbaGameOddsBoard detail={detail} boards={[makeBoard("pinnacle")]} />,
    );

    const header = screen.getByRole("heading", { name: "Odds" }).parentElement;
    expect(header?.textContent).toMatch(/\d/);
    expect(header?.textContent).not.toMatch(/Pinnacle/);
  });

  it("shows dashes for missing moneyline and prices", () => {
    render(
      <WnbaGameOddsBoard
        detail={detail}
        boards={[
          makeBoard("draftkings", {
            rows: [
              {
                side: "away",
                money: { kind: "money", price: null },
                total: { kind: "total", side: "over", line: 162.5, price: null },
                spread: { kind: "spread", line: 4.5, price: null },
              },
              {
                side: "home",
                money: { kind: "money", price: null },
                total: {
                  kind: "total",
                  side: "under",
                  line: 162.5,
                  price: null,
                },
                spread: { kind: "spread", line: -4.5, price: null },
              },
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText("o162.5")).toBeInTheDocument();
    // 2 money primary + 4 total/spread secondary price dashes
    expect(screen.getAllByText("–")).toHaveLength(6);
  });
});
