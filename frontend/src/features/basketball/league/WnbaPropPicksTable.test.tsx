import { render, screen } from "@testing-library/react";
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
    dfs: [{ book: "prizepicks", american: null, url: null }],
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
    render(<WnbaPropPicksTable rows={[fixtureRow()]} />);
    expect(screen.getByText("Proposition")).toBeInTheDocument();
    expect(screen.getByText("Line")).toBeInTheDocument();
    expect(screen.getByText("DFS")).toBeInTheDocument();
    expect(screen.getByText("Odds")).toBeInTheDocument();
    expect(screen.getByText("IP")).toBeInTheDocument();
    expect(screen.queryByText("Opp Def Rank")).not.toBeInTheDocument();
    expect(screen.getByText("L5")).toBeInTheDocument();
    expect(screen.getByText("H2H")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "PrizePicks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "DFS" })).not.toBeInTheDocument();
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

  it("renders the composite cell and DFS PrizePicks juice", () => {
    render(<WnbaPropPicksTable rows={[fixtureRow()]} />);
    expect(screen.getByTestId("board-row-name")).toHaveTextContent("Caitlin Clark");
    expect(screen.getByTestId("board-row-matchup")).toHaveTextContent("IND @ NYL");
    expect(screen.getByTestId("board-row-market")).toHaveTextContent("Over 18.5 Points");
    expect(screen.getByTestId("line-cell")).toHaveTextContent("18.5");
    expect(screen.getByTestId("dfs-cell")).toHaveTextContent("-137");
    expect(screen.getByTestId("ip-cell")).toHaveTextContent("53%");
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
