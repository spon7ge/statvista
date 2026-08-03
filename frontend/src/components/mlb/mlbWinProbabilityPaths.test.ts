import { describe, expect, it } from "vitest";
import { toDisplayPct } from "./mlbWinProbabilityPaths";

describe("mlbWinProbabilityPaths", () => {
  it("converts API 0–1 home_win_pct to display percent", () => {
    expect(toDisplayPct(0.48)).toBe(48);
  });
});
