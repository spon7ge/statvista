import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApiWnbaPropBoardRow } from "@/shared/lib/api";
import { WnbaPropPicksTable } from "./WnbaPropPicksTable";

function fixtureRow(
  over: Partial<ApiWnbaPropBoardRow> = {},
): ApiWnbaPropBoardRow {
  return {
    player_name: "Caitlin Clark",
    headshot_url: null,
    team_abbrev: "IND",
    opponent_abbrev: "NYL",
    home_away: "away",
    stat: "points",
    market_label: "Over 18.5 Points",
    side: "over",
    line: 18.5,
    game_id: "401810001",
    game_start_at: "2026-08-23T23:10:00Z",
    anchor: {
      book: "prizepicks",
      american: -137,
      url: null,
      line: 18.5,
      devig_pct: null,
      over_american: -137,
      under_american: -137,
    },
    books: [{ book: "prophetx", american: -115, url: null, line: 18.5 }],
    ip_pct: 53,
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

describe("WnbaPropPicksTable", () => {
  it("renders board columns and no dfs tabs", () => {
    render(
      <WnbaPropPicksTable
        rows={[
          fixtureRow({
            books: [
              { book: "prophetx", american: -115, url: null, line: 18.5 },
              { book: "draftkings", american: -120, url: null, line: 20.5 },
            ],
          }),
        ]}
      />,
    );
    expect(screen.getByText("Proposition")).toBeInTheDocument();
    expect(screen.getByText("Line")).toBeInTheDocument();
    expect(screen.queryByText("DFS")).not.toBeInTheDocument();
    expect(screen.getByText("Odds")).toBeInTheDocument();
    expect(screen.getByText("IP")).toBeInTheDocument();
    expect(screen.queryByText("Opp Def Rank")).not.toBeInTheDocument();
    expect(screen.getByText("L5")).toBeInTheDocument();
    expect(screen.getByText("H2H")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "PrizePicks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "DFS" })).not.toBeInTheDocument();
    const lineCell = screen.getByTestId("line-cell");
    expect(lineCell).toHaveTextContent("18.5");
    expect(lineCell).toHaveTextContent("-137");
    expect(
      lineCell.querySelector('svg[aria-label="PrizePicks"]'),
    ).toBeTruthy();
    const odds = screen.getByTestId("odds-cell");
    expect(within(odds).queryByText("18.5")).not.toBeInTheDocument();
    expect(within(odds).getByText("-115")).toBeInTheDocument();
    expect(within(odds).queryByText("20.5")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dfs-cell")).not.toBeInTheDocument();
  });

  it("paints L5 through H2H as green, yellow, and red hit-rate boxes", () => {
    render(
      <WnbaPropPicksTable
        rows={[
          fixtureRow({
            hit_l5: 90,
            hit_l10: 65,
            hit_l15: 33,
            hit_h2h: 50,
          }),
        ]}
      />,
    );
    expect(screen.getByTestId("hit-l5-cell").className).toContain(
      "bg-emerald-500/15",
    );
    expect(screen.getByTestId("hit-l10-cell").className).toContain(
      "bg-amber-500/15",
    );
    expect(screen.getByTestId("hit-l15-cell").className).toContain(
      "bg-rose-500/15",
    );
    expect(screen.getByTestId("hit-h2h-cell").className).toContain(
      "bg-amber-500/15",
    );
  });

  it("renders em dash for null ip and hit rates", () => {
    render(
      <WnbaPropPicksTable
        rows={[
          fixtureRow({
            ip_pct: null,
            hit_l5: null,
            hit_l10: null,
            hit_l15: null,
            hit_h2h: null,
          }),
        ]}
      />,
    );
    expect(screen.getByTestId("ip-cell")).toHaveTextContent("—");
    expect(screen.getByTestId("hit-l5-cell")).toHaveTextContent("—");
    expect(screen.getByTestId("hit-h2h-cell")).toHaveTextContent("—");
  });

  it("renders the composite cell and remaining column headers", () => {
    render(<WnbaPropPicksTable rows={[fixtureRow()]} />);
    expect(screen.getByTestId("board-row-name")).toHaveTextContent("Caitlin Clark");
    expect(screen.queryByTestId("board-row-matchup")).not.toBeInTheDocument();
    expect(screen.queryByText("IND @ NYL")).not.toBeInTheDocument();
    expect(screen.getByTestId("board-row-market")).toHaveTextContent("Over 18.5 Points");
    const lineCell = screen.getByTestId("line-cell");
    expect(lineCell).toHaveTextContent("18.5");
    expect(lineCell).toHaveTextContent("-137");
    expect(
      lineCell.querySelector('svg[aria-label="PrizePicks"]'),
    ).toBeTruthy();
    expect(screen.getByTestId("ip-cell")).toHaveTextContent("53%");
    expect(screen.queryByTestId("dfs-cell")).not.toBeInTheDocument();
  });

  it("puts the PrizePicks American in the line cell with no de-vig percent", () => {
    render(
      <WnbaPropPicksTable
        rows={[
          fixtureRow({
            books: [
              {
                book: "prophetx",
                american: -122,
                url: null,
                devig_pct: 54,
              },
            ],
          }),
        ]}
      />,
    );
    const lineCell = screen.getByTestId("line-cell");
    expect(lineCell).toHaveTextContent("18.5");
    expect(lineCell).toHaveTextContent("-137");
    expect(
      lineCell.querySelector('svg[aria-label="PrizePicks"]'),
    ).toBeTruthy();
    expect(lineCell).not.toHaveTextContent("(54%)");
    expect(screen.queryByTestId("dfs-cell")).not.toBeInTheDocument();
  });

  it("stacks the anchor book mark and em dash when American is missing", () => {
    render(
      <WnbaPropPicksTable
        rows={[
          fixtureRow({
            anchor: {
              book: "draftkings",
              american: null,
              url: null,
              line: 18.5,
              devig_pct: null,
              over_american: null,
              under_american: null,
            },
          }),
        ]}
      />,
    );
    const lineCell = screen.getByTestId("line-cell");
    expect(lineCell).toHaveTextContent("18.5");
    expect(lineCell).toHaveTextContent("—");
    expect(
      lineCell.querySelector('svg[aria-label="DraftKings"]'),
    ).toBeTruthy();
    expect(lineCell).not.toHaveTextContent("-137");
  });

  it("renders an em dash when no other books match the line", () => {
    render(
      <WnbaPropPicksTable
        rows={[
          fixtureRow({
            books: [
              { book: "draftkings", american: -120, url: null, line: 20.5 },
            ],
          }),
        ]}
      />,
    );
    expect(screen.getByTestId("odds-cell")).toHaveTextContent("—");
  });

  it("shows No board yet when there are no rows", () => {
    render(<WnbaPropPicksTable rows={[]} />);
    expect(screen.getByText("No board yet")).toBeInTheDocument();
  });

  it("overlaps the team logo on the player headshot", () => {
    render(
      <WnbaPropPicksTable
        rows={[fixtureRow({ headshot_url: "https://example.com/clark.png" })]}
      />,
    );
    const icon = screen.getByTestId("board-row-player-icon");
    expect(icon.querySelector('img[src="https://example.com/clark.png"]')).toBeTruthy();
    expect(screen.getByTestId("board-row-team-logo")).toHaveAttribute(
      "src",
      "https://a.espncdn.com/i/teamlogos/wnba/500/ind.png",
    );
  });
});
