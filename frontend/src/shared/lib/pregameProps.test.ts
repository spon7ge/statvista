import { describe, expect, it } from "vitest";
import { excludeStartedPropRows } from "./pregameProps";

const NOW = new Date("2026-10-16T20:00:00Z");

describe("excludeStartedPropRows", () => {
  it("keeps props whose tip is still in the future", () => {
    const rows = [
      { player_name: "Later", game_start_at: "2026-10-16T23:00:00Z" },
    ];

    expect(excludeStartedPropRows(rows, NOW).map((row) => row.player_name)).toEqual([
      "Later",
    ]);
  });

  it("drops players who are not on the loaded slate", () => {
    const rows = [
      { player_name: "On slate", game_start_at: "2026-10-16T23:00:00Z", game_id: "1" },
      { player_name: "A'ja Wilson", game_start_at: null, game_id: null },
    ];

    expect(excludeStartedPropRows(rows, NOW).map((row) => row.player_name)).toEqual([
      "On slate",
    ]);
  });

  it("keeps unmatched props when no slate loaded", () => {
    const rows = [
      { player_name: "Unknown", game_start_at: null, game_id: null },
    ];

    expect(excludeStartedPropRows(rows, NOW).map((row) => row.player_name)).toEqual([
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
