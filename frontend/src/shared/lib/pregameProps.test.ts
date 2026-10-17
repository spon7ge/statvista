import { describe, expect, it } from "vitest";
import { excludeStartedPropRows } from "./pregameProps";

const NOW = new Date("2026-10-16T20:00:00Z");

describe("excludeStartedPropRows", () => {
  it("keeps props whose tip is still in the future", () => {
    const rows = [
      { player_name: "Later", game_start_at: "2026-10-16T23:00:00Z" },
      { player_name: "Unknown", game_start_at: null },
    ];

    expect(excludeStartedPropRows(rows, NOW).map((row) => row.player_name)).toEqual([
      "Later",
      "Unknown",
    ]);
  });

  it("removes props once the listed tip has passed", () => {
    const rows = [
      { player_name: "Started", game_start_at: "2026-10-16T19:00:00Z" },
      { player_name: "Tipping", game_start_at: "2026-10-16T20:00:00Z" },
      { player_name: "Later", game_start_at: "2026-10-16T23:00:00Z" },
    ];

    expect(excludeStartedPropRows(rows, NOW).map((row) => row.player_name)).toEqual([
      "Later",
    ]);
  });
});
