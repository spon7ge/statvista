import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApiNbaPropBoardRow } from "@/shared/lib/api";
import { NbaPropPicksTable } from "./NbaPropPicksTable";

function fixtureRow(
  over: Partial<ApiNbaPropBoardRow> = {},
): ApiNbaPropBoardRow {
  return {
    player_name: "Jayson Tatum",
    headshot_url: null,
    team_abbrev: "BOS",
    opponent_abbrev: "NYK",
    home_away: "away",
    stat: "points",
    market_label: "Over 27.5 Points",
    side: "over",
    line: 27.5,
    game_id: "401810001",
    game_start_at: "2026-10-23T23:30:00Z",
    anchor: {
      book: "prizepicks",
      american: -137,
      url: null,
      line: 27.5,
      devig_pct: null,
      over_american: -137,
      under_american: -137,
    },
    books: [{ book: "draftkings", american: -110, url: null, line: 27.5 }],
    ip_pct: 55,
    opp_def_rank: null,
    opp_def_label: null,
    opp_pace_rank: null,
    opp_pace_label: null,
    hit_l5: 80,
    hit_l10: 70,
    hit_l15: 60,
    hit_h2h: 50,
    ...over,
  };
}

describe("NbaPropPicksTable", () => {
  it("stacks the PrizePicks mark under the line number", () => {
    render(<NbaPropPicksTable rows={[fixtureRow()]} />);
    const lineCell = screen.getByTestId("line-cell");
    expect(lineCell).toHaveTextContent("27.5");
    expect(lineCell).toHaveTextContent("-137");
    expect(
      lineCell.querySelector('svg[aria-label="PrizePicks"]'),
    ).toBeTruthy();
    const odds = screen.getByTestId("odds-cell");
    expect(within(odds).getByText("-110")).toBeInTheDocument();
    expect(within(odds).queryByText("27.5")).not.toBeInTheDocument();
  });

  it("stacks the anchor book mark and em dash when American is missing", () => {
    render(
      <NbaPropPicksTable
        rows={[
          fixtureRow({
            anchor: {
              book: "draftkings",
              american: null,
              url: null,
              line: 27.5,
              devig_pct: null,
              over_american: null,
              under_american: null,
            },
          }),
        ]}
      />,
    );
    const lineCell = screen.getByTestId("line-cell");
    expect(lineCell).toHaveTextContent("27.5");
    expect(lineCell).toHaveTextContent("—");
    expect(
      lineCell.querySelector('svg[aria-label="DraftKings"]'),
    ).toBeTruthy();
    expect(lineCell).not.toHaveTextContent("-137");
  });

  it("does not show a matchup next to the player name", () => {
    render(<NbaPropPicksTable rows={[fixtureRow()]} />);
    expect(screen.getByTestId("board-row-name")).toHaveTextContent(
      "Jayson Tatum",
    );
    expect(screen.getByTestId("board-row-market")).toHaveTextContent(
      "Over 27.5 Points",
    );
    expect(screen.queryByTestId("board-row-matchup")).not.toBeInTheDocument();
    expect(screen.queryByText("BOS @ NYK")).not.toBeInTheDocument();
  });
});
