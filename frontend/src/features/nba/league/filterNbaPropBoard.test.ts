import { describe, expect, it } from "vitest";
import { filterNbaPropBoardRows } from "./filterNbaPropBoard";
import type { ApiNbaPropBoardRow } from "@/shared/lib/api";

const row = (over: Partial<ApiNbaPropBoardRow>): ApiNbaPropBoardRow =>
  ({
    player_name: "Jayson Tatum",
    headshot_url: null,
    team_abbrev: "BOS",
    opponent_abbrev: "NYK",
    home_away: "away",
    stat: "points",
    market_label: "Over 27.5 Points",
    side: "over",
    line: 27.5,
    game_id: "1",
    game_start_at: null,
    anchor: { book: "prizepicks", american: -137, url: null, line: 27.5 },
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
  }) as ApiNbaPropBoardRow;

describe("filterNbaPropBoardRows", () => {
  it("keeps rows whose book count is one of the selected counts", () => {
    const rows = [
      row({ player_name: "Jayson Tatum" }),
      row({ player_name: "Jaylen Brown", books: [] }),
    ];
    expect(
      filterNbaPropBoardRows(rows, {
        query: "",
        bookCounts: new Set(["1"]),
      }).map((r) => r.player_name),
    ).toEqual(["Jaylen Brown"]);
  });
});
