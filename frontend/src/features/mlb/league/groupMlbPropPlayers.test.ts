import { describe, expect, it } from "vitest";
import {
  findPlayerBySlug,
  groupMlbPropPlayers,
  slugifyPlayerName,
  uniqueStatRows,
} from "./groupMlbPropPlayers";
import type { ApiMlbPropRow } from "@/shared/lib/api";

function row(
  partial: Partial<ApiMlbPropRow> & Pick<ApiMlbPropRow, "player_name" | "stat" | "line">,
): ApiMlbPropRow {
  return {
    team_abbrev: "NYY",
    headshot_url: null,
    position: "OF",
    recommended_side: "over",
    fair_pct: null,
    edge_pct: null,
    alt_edge_pct: null,
    source_tier: "no_sharp_read",
    confidence_chips: [],
    sample_chips: [],
    recency_chip: null,
    books: {
      prophetx: null,
      novig: null,
      draftkings: null,
      fanduel: null,
      pinnacle: null,
    },
    books_main: {
      prophetx: null,
      novig: null,
      draftkings: null,
      fanduel: null,
      pinnacle: null,
    },
    dfs: { line: partial.line, changed_at: null, american: null, payout_multiplier: null },
    fair_explain: "",
    ...partial,
  };
}

describe("groupMlbPropPlayers", () => {
  it("counts unique stats and sorts by count desc", () => {
    const players = groupMlbPropPlayers([
      row({ player_name: "A", stat: "Strikeouts", line: 6.5 }),
      row({ player_name: "B", stat: "Hits", line: 1.5 }),
      row({ player_name: "A", stat: "Walks", line: 2.5 }),
      row({ player_name: "A", stat: "Strikeouts", line: 7.5 }), // same stat
    ]);
    expect(players[0]?.player_name).toBe("A");
    expect(players[0]?.prop_count).toBe(2);
    expect(players[1]?.prop_count).toBe(1);
  });

  it("slugifies and finds by slug", () => {
    expect(slugifyPlayerName("Aaron Judge")).toBe("aaron-judge");
    const players = groupMlbPropPlayers([
      row({ player_name: "Aaron Judge", stat: "Hits", line: 1.5 }),
    ]);
    expect(findPlayerBySlug(players, "aaron-judge")?.player_name).toBe(
      "Aaron Judge",
    );
  });
});

describe("uniqueStatRows", () => {
  it("keeps first row per stat", () => {
    const rows = uniqueStatRows([
      row({ player_name: "A", stat: "Strikeouts", line: 6.5 }),
      row({ player_name: "A", stat: "Strikeouts", line: 7.5 }),
      row({ player_name: "A", stat: "Walks", line: 2.5 }),
    ]);
    expect(rows.map((r) => r.stat)).toEqual(["Strikeouts", "Walks"]);
    expect(rows[0]?.line).toBe(6.5);
  });
});
