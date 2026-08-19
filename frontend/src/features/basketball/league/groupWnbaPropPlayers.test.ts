import { describe, expect, it } from "vitest";
import {
  findPlayerBySlug,
  groupWnbaPropPlayers,
  slugifyPlayerName,
  uniqueStatRows,
} from "./groupWnbaPropPlayers";
import type { ApiWnbaPropRow } from "@/shared/lib/api";

function row(
  partial: Partial<ApiWnbaPropRow> & Pick<ApiWnbaPropRow, "player_name" | "stat" | "line">,
): ApiWnbaPropRow {
  return {
    team_abbrev: "NYL",
    headshot_url: null,
    position: "G",
    commence_time: null,
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
      betmgm: null,
      caesars: null,
      kalshi: null,
      fliff: null,
      bet365: null,
      pinnacle: null,
    },
    dfs: { line: partial.line, changed_at: null, american: null, payout_multiplier: null },
    fair_explain: "",
    ...partial,
  };
}

describe("groupWnbaPropPlayers", () => {
  it("counts unique stats and sorts by count desc", () => {
    const players = groupWnbaPropPlayers([
      row({ player_name: "A", stat: "Points", line: 18.5 }),
      row({ player_name: "B", stat: "Rebounds", line: 8.5 }),
      row({ player_name: "A", stat: "Assists", line: 5.5 }),
      row({ player_name: "A", stat: "Points", line: 20.5 }), // same stat
    ]);
    expect(players[0]?.player_name).toBe("A");
    expect(players[0]?.prop_count).toBe(2);
    expect(players[1]?.prop_count).toBe(1);
  });

  it("slugifies and finds by slug", () => {
    expect(slugifyPlayerName("A'ja Wilson")).toBe("a-ja-wilson");
    const players = groupWnbaPropPlayers([
      row({ player_name: "A'ja Wilson", stat: "Points", line: 22.5 }),
    ]);
    expect(findPlayerBySlug(players, "a-ja-wilson")?.player_name).toBe(
      "A'ja Wilson",
    );
  });

  it("disambiguates colliding names with team abbrev in the slug", () => {
    const players = groupWnbaPropPlayers([
      row({
        player_name: "Taylor Smith",
        team_abbrev: "NYL",
        stat: "Points",
        line: 12.5,
      }),
      row({
        player_name: "Taylor Smith",
        team_abbrev: "LVA",
        stat: "Rebounds",
        line: 6.5,
      }),
    ]);
    expect(players).toHaveLength(2);
    const nyl = findPlayerBySlug(players, "taylor-smith-nyl");
    const lva = findPlayerBySlug(players, "taylor-smith-lva");
    expect(nyl?.team_abbrev).toBe("NYL");
    expect(lva?.team_abbrev).toBe("LVA");
    expect(findPlayerBySlug(players, "taylor-smith")).toBeNull();
  });
});

describe("uniqueStatRows", () => {
  it("keeps first row per stat", () => {
    const rows = uniqueStatRows([
      row({ player_name: "A", stat: "Points", line: 18.5 }),
      row({ player_name: "A", stat: "Points", line: 20.5 }),
      row({ player_name: "A", stat: "Assists", line: 5.5 }),
    ]);
    expect(rows.map((r) => r.stat)).toEqual(["Points", "Assists"]);
    expect(rows[0]?.line).toBe(18.5);
  });
});
