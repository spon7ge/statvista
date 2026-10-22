import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ApiNbaTeamPreviewResponse } from "@/shared/lib/api";
import { NbaTeamPreview } from "./NbaTeamPreview";

const fixture: ApiNbaTeamPreviewResponse = {
  side: "away",
  team: { id: "9", abbrev: "GS", name: "Golden State Warriors", logo_url: null },
  leaders: [],
  roster: [
    {
      player_id: "1",
      name: "S. Curry",
      jersey: "30",
      position: "G",
      gp: 4,
      min: "32.0",
      pts: "28.5",
      reb: "4.0",
      ast: "6.1",
      stl: "1.0",
      blk: "0.2",
      to: "2.4",
      fg_pct: ".470",
      fg3_pct: ".410",
      ft_pct: ".920",
      usg_pct: "31.2",
      efg_pct: "58.4",
      ts_pct: "62.0",
      ast_pct: "28.0",
      ast_to: "2.5",
      oreb_pct: "1.1",
      dreb_pct: "8.4",
      reb_pct: "5.0",
      tov_pct: "12.0",
      off_rtg: "120.0",
      def_rtg: "108.0",
      net_rtg: "12.0",
      pie: "18.5",
      sh_eff: null,
      sc_eff: null,
      ppep: null,
      rtg: null,
      plus_minus: null,
      headshot_url: null,
    },
  ],
};

describe("NbaTeamPreview", () => {
  it("shows usage and efficiency after FT% on the roster", () => {
    render(<NbaTeamPreview data={fixture} isPending={false} error={null} />);

    const table = screen.getByTestId("nba-team-roster-table");
    const text = table.textContent ?? "";
    const ft = text.indexOf("FT%");
    const usg = text.indexOf("USG%");
    const efg = text.indexOf("EFG%");
    const ts = text.indexOf("TS%");
    const pie = text.indexOf("PIE");
    const rtg = text.indexOf("RTG");
    expect(ft).toBeLessThan(usg);
    expect(usg).toBeLessThan(efg);
    expect(efg).toBeLessThan(ts);
    expect(ts).toBeLessThan(pie);
    expect(pie).toBeLessThan(rtg);
    expect(screen.queryByText("SH-EFF")).not.toBeInTheDocument();
    expect(screen.queryByText("SC-EFF")).not.toBeInTheDocument();
    expect(screen.queryByText("PPEP")).not.toBeInTheDocument();
    expect(text).toContain("31.2");
    expect(text).toContain("58.4");
    expect(text).toContain("62.0");
  });
});
