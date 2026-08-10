import { describe, expect, it } from "vitest";
import { deriveQuarterLinescore } from "./quarterLinescore";

describe("deriveQuarterLinescore", () => {
  it("returns null when there are no scoring plays", () => {
    expect(deriveQuarterLinescore([], 0, 0)).toBeNull();
  });

  it("derives period deltas from cumulative scoring play scores", () => {
    const plays = [
      {
        id: "1",
        teamId: "a",
        period: 1,
        clock: "0:01",
        text: "x",
        scoring: true,
        awayScore: 10,
        homeScore: 8,
        shooting: false,
      },
      {
        id: "2",
        teamId: "a",
        period: 2,
        clock: "5:00",
        text: "y",
        scoring: true,
        awayScore: 18,
        homeScore: 15,
        shooting: false,
      },
    ];
    // Implementation may reverse newest-first API order internally.
    const result = deriveQuarterLinescore([...plays].reverse(), 18, 15);
    expect(result?.periods).toEqual([
      { period: 1, away: 10, home: 8 },
      { period: 2, away: 8, home: 7 },
    ]);
    expect(result?.awayTotal).toBe(18);
    expect(result?.homeTotal).toBe(15);
  });
});
