import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ApiMlbPropBoardRow } from "@/shared/lib/api";
import { MlbPropPicksTable } from "./MlbPropPicksTable";

function fixtureRow(
  over: Partial<ApiMlbPropBoardRow> = {},
): ApiMlbPropBoardRow {
  return {
    player_name: "Aaron Judge",
    headshot_url: null,
    team_abbrev: "NYY",
    opponent_abbrev: "BOS",
    home_away: "away",
    stat: "hits",
    market_label: "Over 1.5 Hits",
    side: "over",
    line: 1.5,
    game_pk: 1,
    game_start_at: "2026-08-23T23:10:00Z",
    dfs: [{ book: "prizepicks", american: null, url: null }],
    books: [{ book: "prophetx", american: -115, url: null }],
    ip_pct: 53,
    opp_def_rank: 12,
    opp_def_label: "12th BOS",
    opp_pace_rank: 4,
    opp_pace_label: "4th BOS",
    hit_l5: 80,
    hit_l10: 70,
    hit_l15: 60,
    hit_h2h: 50,
    ...over,
  };
}

describe("MlbPropPicksTable", () => {
  it("renders board columns and no dfs tabs", () => {
    render(<MlbPropPicksTable rows={[fixtureRow()]} />);
    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
    expect(screen.getByText("Proposition")).toBeInTheDocument();
    expect(screen.getByText("Line")).toBeInTheDocument();
    expect(screen.getByText("DFS")).toBeInTheDocument();
    expect(screen.getByText("Odds")).toBeInTheDocument();
    expect(screen.getByText("IP")).toBeInTheDocument();
    expect(screen.queryByText("Opp Def Rank")).not.toBeInTheDocument();
    expect(screen.queryByText("Opp Pace Rank")).not.toBeInTheDocument();
    expect(screen.getByText("L5")).toBeInTheDocument();
    expect(screen.getByText("H2H")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "PrizePicks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "DFS" })).not.toBeInTheDocument();
  });

  it("renders em dash for null ip", () => {
    render(<MlbPropPicksTable rows={[{ ...fixtureRow(), ip_pct: null }]} />);
    expect(screen.getByTestId("ip-cell")).toHaveTextContent("—");
  });

  it("renders a percent sign next to each IP value", () => {
    render(<MlbPropPicksTable rows={[fixtureRow({ ip_pct: 53 })]} />);
    expect(screen.getByTestId("ip-cell")).toHaveTextContent("53%");
  });

  it("renders the composite cell and remaining column headers", () => {
    render(<MlbPropPicksTable rows={[fixtureRow()]} />);
    expect(screen.getByTestId("board-row-name")).toHaveTextContent("Aaron Judge");
    expect(screen.getByTestId("board-row-name")).toHaveClass("font-bold");
    expect(screen.getByTestId("board-row-matchup")).toHaveTextContent("NYY @ BOS");
    const market = screen.getByTestId("board-row-market");
    expect(market).toHaveTextContent("Over 1.5 Hits");
    expect(market).toHaveClass("truncate", "text-sm", "font-bold");
    expect(screen.getByTestId("line-cell")).toHaveTextContent("1.5");
    expect(screen.getByText("Odds")).toBeInTheDocument();
    expect(screen.getByText("L10")).toBeInTheDocument();
    expect(screen.getByText("L15")).toBeInTheDocument();
    expect(screen.getByText("H2H")).toBeInTheDocument();
  });

  it("overlaps the team logo on the player headshot", () => {
    render(
      <MlbPropPicksTable
        rows={[fixtureRow({ headshot_url: "https://example.com/judge.png" })]}
      />,
    );
    const icon = screen.getByTestId("board-row-player-icon");
    expect(icon.querySelector('img[src="https://example.com/judge.png"]')).toBeTruthy();
    expect(screen.getByTestId("board-row-team-logo")).toHaveAttribute(
      "src",
      "https://www.mlbstatic.com/team-logos/147.svg",
    );
  });

  it("shows No board yet when there are no rows", () => {
    render(<MlbPropPicksTable rows={[]} />);
    expect(screen.getByText("No board yet")).toBeInTheDocument();
  });

  it("renders em dash for null hit rates", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            hit_l5: null,
            hit_l10: null,
            hit_l15: null,
            hit_h2h: null,
          }),
        ]}
      />,
    );
    expect(screen.getByTestId("hit-l5-cell")).toHaveTextContent("—");
    expect(screen.getByTestId("hit-l10-cell")).toHaveTextContent("—");
    expect(screen.getByTestId("hit-l15-cell")).toHaveTextContent("—");
    expect(screen.getByTestId("hit-h2h-cell")).toHaveTextContent("—");
  });

  it("wraps each board row in a boxed card with a gap and hover highlight", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow(),
          fixtureRow({ player_name: "Mookie Betts", game_pk: 2 }),
        ]}
      />,
    );
    const table = screen.getByRole("table");
    expect(table.className).toContain("border-separate");
    expect(table.className).toContain("border-spacing-y-1.5");
    const rows = screen.getAllByTestId("board-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveClass("group");
    expect(rows[0].querySelector("td")?.className).toContain(
      "group-hover:bg-white/[0.08]",
    );
    expect(rows[0].querySelector("td")?.className).toContain("rounded-l-lg");
    expect(screen.getAllByTestId("hit-h2h-cell")[0]?.className).toContain(
      "rounded-r-lg",
    );
  });

  it("paints L5 through H2H as full hit-rate boxes", () => {
    render(
      <MlbPropPicksTable
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
    expect(screen.getByTestId("hit-l5-cell").className).toContain("bg-emerald-500/15");
    expect(screen.getByTestId("hit-l10-cell").className).toContain("bg-amber-500/15");
    expect(screen.getByTestId("hit-l15-cell").className).toContain("bg-rose-500/15");
    expect(screen.getByTestId("hit-h2h-cell").className).toContain("bg-amber-500/15");
    expect(screen.queryByTestId("hit-l5-cell-indicator")).not.toBeInTheDocument();
  });

  it("renders home matchups as opponent @ team", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            home_away: "home",
            team_abbrev: "NYY",
            opponent_abbrev: "BOS",
          }),
        ]}
      />,
    );
    expect(screen.getByTestId("board-row-matchup")).toHaveTextContent("BOS @ NYY");
  });

  it("sorts by game start, name, stat, Over then Under, then line by default", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            player_name: "Zack Late",
            game_start_at: "2026-08-23T23:10:00Z",
            stat: "hits",
            side: "over",
            line: 1.5,
            market_label: "Over 1.5 Hits",
          }),
          fixtureRow({
            player_name: "Aaron Early",
            game_start_at: "2026-08-23T20:10:00Z",
            stat: "hits",
            side: "under",
            line: 0.5,
            market_label: "Under 0.5 Hits",
          }),
          fixtureRow({
            player_name: "Aaron Early",
            game_start_at: "2026-08-23T20:10:00Z",
            stat: "hits",
            side: "over",
            line: 1.5,
            market_label: "Over 1.5 Hits",
          }),
          fixtureRow({
            player_name: "Aaron Early",
            game_start_at: "2026-08-23T20:10:00Z",
            stat: "runs",
            side: "over",
            line: 0.5,
            market_label: "Over 0.5 Runs",
          }),
        ]}
      />,
    );
    const names = screen.getAllByTestId("board-row-name").map((el) => el.textContent);
    const markets = screen
      .getAllByTestId("board-row-market")
      .map((el) => el.textContent);
    expect(names).toEqual([
      "Aaron Early",
      "Aaron Early",
      "Aaron Early",
      "Zack Late",
    ]);
    expect(markets).toEqual([
      "Over 1.5 Hits",
      "Under 0.5 Hits",
      "Over 0.5 Runs",
      "Over 1.5 Hits",
    ]);
  });

  it("sorts a numeric column from the header and parks nulls last", async () => {
    const user = userEvent.setup();
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({ player_name: "Mid", ip_pct: 50 }),
          fixtureRow({ player_name: "High", ip_pct: 80 }),
          fixtureRow({ player_name: "Missing", ip_pct: null }),
          fixtureRow({ player_name: "Low", ip_pct: 20 }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "IP" }));
    expect(screen.getAllByTestId("board-row-name").map((el) => el.textContent)).toEqual([
      "Low",
      "Mid",
      "High",
      "Missing",
    ]);

    await user.click(screen.getByRole("button", { name: "IP" }));
    expect(screen.getAllByTestId("board-row-name").map((el) => el.textContent)).toEqual([
      "High",
      "Mid",
      "Low",
      "Missing",
    ]);
  });

  it("shows three odds chips plus overflow and omits DFS American", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            dfs: [{ book: "prizepicks", american: null, url: null }],
            books: [
              { book: "prophetx", american: -115, url: null },
              { book: "novig", american: -110, url: null },
              { book: "pinnacle", american: -105, url: null },
              { book: "draftkings", american: -120, url: null },
              { book: "fanduel", american: -108, url: null },
            ],
          }),
        ]}
      />,
    );
    const odds = screen.getByTestId("odds-cell");
    expect(within(odds).getByText("-115")).toBeInTheDocument();
    expect(within(odds).getByText("-110")).toBeInTheDocument();
    expect(within(odds).getByText("-105")).toBeInTheDocument();
    expect(within(odds).queryByText("-120")).not.toBeInTheDocument();
    expect(within(odds).getByText("+2")).toBeInTheDocument();
    expect(odds.querySelector('svg[aria-label="PrizePicks"]')).toBeNull();
    expect(screen.getByTestId("dfs-cell").querySelector('svg[aria-label="PrizePicks"]')).toBeTruthy();
  });

  it("shows overflow books on hover of the +N down arrow", async () => {
    const user = userEvent.setup();
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            books: [
              { book: "prophetx", american: -115, url: null },
              { book: "novig", american: -110, url: null },
              { book: "pinnacle", american: -105, url: null },
              { book: "draftkings", american: -120, url: null },
              { book: "fanduel", american: -108, url: null },
              { book: "betmgm", american: -112, url: null },
            ],
          }),
        ]}
      />,
    );
    const odds = screen.getByTestId("odds-cell");
    expect(within(odds).getByText("+3")).toBeInTheDocument();
    expect(odds.querySelector('svg[aria-label="DraftKings"]')).toBeNull();
    expect(odds.querySelector('svg[aria-label="FanDuel"]')).toBeNull();
    expect(odds.querySelector('svg[aria-label="BetMGM"]')).toBeNull();
    expect(screen.queryByTestId("odds-overflow-panel")).not.toBeInTheDocument();

    const arrow = screen.getByTestId("odds-overflow-arrow");
    expect(arrow.querySelector("svg")).not.toHaveClass("rotate-180");

    await user.hover(arrow);
    const panel = await screen.findByTestId("odds-overflow-panel");
    expect(arrow.querySelector("svg")).toHaveClass("rotate-180");
    expect(panel.querySelector('svg[aria-label="DraftKings"]')).toBeTruthy();
    expect(panel.querySelector('svg[aria-label="FanDuel"]')).toBeTruthy();
    expect(panel.querySelector('svg[aria-label="BetMGM"]')).toBeTruthy();
    expect(within(panel).getByText("-120")).toBeInTheDocument();
    expect(within(panel).getByText("-108")).toBeInTheDocument();
    expect(within(panel).getByText("-112")).toBeInTheDocument();
    expect(within(panel).queryByText("-115")).not.toBeInTheDocument();
  });

  it("renders PIN and 365 book marks in bold", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            books: [
              { book: "pinnacle", american: -105, url: null },
              { book: "bet365", american: -110, url: null },
            ],
          }),
        ]}
      />,
    );
    const odds = screen.getByTestId("odds-cell");
    expect(within(odds).getByText("PIN")).toHaveClass("font-bold");
    expect(within(odds).getByText("365")).toHaveClass("font-bold");
  });

  it("renders asset book marks without a chip box", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            books: [
              { book: "prophetx", american: -115, url: null },
              { book: "novig", american: -110, url: null },
              { book: "draftkings", american: -120, url: null },
              { book: "fanduel", american: -108, url: null },
            ],
          }),
          fixtureRow({
            player_name: "Mookie Betts",
            game_pk: 2,
            dfs: [{ book: "underdog", american: -105, url: null }],
            books: [
              { book: "fliff", american: -102, url: null },
              { book: "betmgm", american: -112, url: null },
              { book: "caesars", american: -118, url: null },
            ],
          }),
        ]}
      />,
    );
    const cells = screen.getAllByTestId("odds-cell");
    const dfsCells = screen.getAllByTestId("dfs-cell");
    expect(cells[0].querySelector('svg[aria-label="ProphetX"]')).toBeTruthy();
    expect(cells[0].querySelector('svg[aria-label="Novig"]')).toBeTruthy();
    expect(cells[0].querySelector('svg[aria-label="DraftKings"]')).toBeTruthy();
    expect(cells[0].querySelector('svg[aria-label="FanDuel"]')).toBeNull();
    expect(cells[1].querySelector('svg[aria-label="Fliff"]')).toBeTruthy();
    expect(cells[1].querySelector('svg[aria-label="BetMGM"]')).toBeTruthy();
    expect(cells[1].querySelector('svg[aria-label="Caesars"]')).toBeTruthy();
    expect(cells[1].querySelector('svg[aria-label="Underdog"]')).toBeNull();
    expect(dfsCells[1].querySelector('svg[aria-label="Underdog"]')).toBeTruthy();
    expect(cells[0].querySelector(".bg-white\\/10")).toBeNull();
    expect(cells[0].querySelector(".rounded-md")).toBeNull();
  });

  it("renders PrizePicks in DFS at -137 with no de-vig percent", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            dfs: [{ book: "prizepicks", american: null, url: null }],
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
    const dfs = screen.getByTestId("dfs-cell");
    expect(dfs.querySelector('svg[aria-label="PrizePicks"]')).toBeTruthy();
    expect(within(dfs).getByText("-137")).toBeInTheDocument();
    expect(within(dfs).queryByText("(54%)")).not.toBeInTheDocument();
    const odds = screen.getByTestId("odds-cell");
    expect(odds.querySelector('svg[aria-label="PrizePicks"]')).toBeNull();
    expect(odds).toHaveTextContent("-122");
    expect(odds).not.toHaveTextContent("(55%)");
  });

  it("renders this side's sportsbook line and odds without implied percent", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            line: 3.5,
            stat: "total_bases",
            market_label: "Over 3.5 Total Bases",
            dfs: [{ book: "prizepicks", american: null, url: null }],
            books: [
              {
                book: "prophetx",
                american: 114,
                url: null,
                line: 3.5,
                over_american: 114,
                under_american: -154,
                devig_pct: 47,
              },
              {
                book: "pinnacle",
                american: -128,
                url: null,
                line: 1.5,
                over_american: -128,
                under_american: -104,
                devig_pct: 54,
              },
            ],
          }),
        ]}
      />,
    );
    const odds = screen.getByTestId("odds-cell");
    expect(odds).toHaveTextContent("3.5");
    expect(odds).toHaveTextContent("+114");
    expect(odds).not.toHaveTextContent("(47%)");
    expect(odds).toHaveTextContent("1.5");
    expect(odds).toHaveTextContent("-128");
    expect(odds).not.toHaveTextContent("(56%)");
    expect(odds).not.toHaveTextContent("-154");
    expect(odds).not.toHaveTextContent("-104");
    expect(odds).not.toHaveTextContent("O 3.5");
    expect(odds).not.toHaveTextContent("U 1.5");
    expect(screen.getByTestId("dfs-cell")).toHaveTextContent("-137");
  });

  it("does not render the opposite side on an under row", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            side: "under",
            market_label: "Under 3.5 Total Bases",
            line: 3.5,
            books: [
              {
                book: "prophetx",
                american: -154,
                url: null,
                line: 3.5,
                over_american: 114,
                under_american: -154,
                devig_pct: 53,
              },
            ],
          }),
        ]}
      />,
    );
    const odds = screen.getByTestId("odds-cell");
    expect(odds).toHaveTextContent("3.5");
    expect(odds).toHaveTextContent("-154");
    expect(odds).not.toHaveTextContent("(61%)");
    expect(odds).not.toHaveTextContent("+114");
  });

  it("renders PrizePicks mark and -137 for every PrizePicks chip", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            dfs: [{ book: "prizepicks", american: null, url: null }],
            books: [],
          }),
        ]}
      />,
    );
    const dfs = screen.getByTestId("dfs-cell");
    expect(dfs.querySelector('svg[aria-label="PrizePicks"]')).toBeTruthy();
    expect(within(dfs).getByText("-137")).toBeInTheDocument();
  });

  it("renders Underdog mark and the dataset American price", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            dfs: [{ book: "underdog", american: -105, url: null }],
            books: [],
          }),
        ]}
      />,
    );
    const dfs = screen.getByTestId("dfs-cell");
    expect(dfs.querySelector('svg[aria-label="Underdog"]')).toBeTruthy();
    expect(within(dfs).getByText("-105")).toBeInTheDocument();
  });

  it("stacks PrizePicks above Underdog when both are posted", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            dfs: [
              { book: "underdog", american: -105, url: null },
              { book: "prizepicks", american: null, url: null },
            ],
            books: [],
          }),
        ]}
      />,
    );
    const dfs = screen.getByTestId("dfs-cell");
    expect(dfs).toHaveClass("flex-col");
    expect(dfs.querySelector('svg[aria-label="PrizePicks"]')).toBeTruthy();
    expect(dfs.querySelector('svg[aria-label="Underdog"]')).toBeTruthy();
  });

  it("hides book marks when that book has no posted American for the line", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            dfs: [{ book: "underdog", american: null, url: null }],
            books: [
              { book: "prophetx", american: -115, url: null },
              { book: "fanduel", american: null, url: null },
              { book: "novig", american: null, url: null },
            ],
          }),
        ]}
      />,
    );
    const odds = screen.getByTestId("odds-cell");
    expect(odds.querySelector('svg[aria-label="ProphetX"]')).toBeTruthy();
    expect(within(odds).getByText("-115")).toBeInTheDocument();
    expect(odds.querySelector('svg[aria-label="FanDuel"]')).toBeNull();
    expect(odds.querySelector('svg[aria-label="Novig"]')).toBeNull();
    expect(screen.getByTestId("dfs-cell")).toHaveTextContent("—");
  });

  it("paginates to 30 rows with next/previous", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 33 }, (_, i) =>
      fixtureRow({
        player_name: `Player ${String(i).padStart(2, "0")}`,
        game_pk: i,
      }),
    );

    render(<MlbPropPicksTable rows={many} />);

    expect(screen.getByText("Showing 1–30 of 33")).toBeInTheDocument();
    expect(screen.getByText("Player 00")).toBeInTheDocument();
    expect(screen.queryByText("Player 30")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing 31–33 of 33")).toBeInTheDocument();
    expect(screen.getByText("Player 30")).toBeInTheDocument();
    expect(screen.queryByText("Player 00")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("sorts by the selected hit-rate window highest to lowest", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({ player_name: "Low", hit_l5: 20 }),
          fixtureRow({ player_name: "High", hit_l5: 90 }),
          fixtureRow({ player_name: "Mid", hit_l5: 50 }),
        ]}
        hitRateWindow="l5"
      />,
    );
    expect(screen.getAllByTestId("board-row-name").map((el) => el.textContent)).toEqual([
      "High",
      "Mid",
      "Low",
    ]);
  });

  it("renders a combined H2H hit rate vs the opponent", () => {
    render(
      <MlbPropPicksTable
        rows={[fixtureRow({ hit_h2h: 67 })]}
      />,
    );
    expect(screen.getByTestId("hit-h2h-cell")).toHaveTextContent("67%");
  });

});
