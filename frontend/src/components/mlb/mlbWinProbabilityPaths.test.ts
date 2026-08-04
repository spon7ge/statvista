import { describe, expect, it } from "vitest";
import {
  getChartGeometry,
  toDisplayPct,
  yForPct,
} from "./mlbWinProbabilityPaths";

describe("mlbWinProbabilityPaths", () => {
  it("converts API 0–1 home_win_pct to display percent", () => {
    expect(toDisplayPct(0.48)).toBe(48);
  });

  it("exposes compact geometry with height 280", () => {
    const compact = getChartGeometry(true);
    expect(compact.height).toBe(280);
    expect(compact.width).toBe(640);
    expect(getChartGeometry(false).height).toBe(520);
  });

  it("maps 50% to vertical midpoint for compact geometry", () => {
    const g = getChartGeometry(true);
    const mid = yForPct(50, g);
    expect(mid).toBe(g.padTop + g.plotHeight / 2);
  });
});
