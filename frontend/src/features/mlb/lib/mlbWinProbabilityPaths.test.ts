import { describe, expect, it } from "vitest";
import {
  getChartGeometry,
  PCT_LABEL_MIN_GAP,
  separatePctLabelYs,
  toDisplayPct,
  yForPct,
} from "./mlbWinProbabilityPaths";

describe("mlbWinProbabilityPaths", () => {
  it("converts API 0–1 home_win_pct to display percent", () => {
    expect(toDisplayPct(0.48)).toBe(48);
  });

  it("exposes compact geometry with height 168", () => {
    const compact = getChartGeometry(true);
    expect(compact.height).toBe(168);
    expect(compact.width).toBe(640);
    expect(getChartGeometry(false).height).toBe(520);
  });

  it("maps 50% to vertical midpoint for compact geometry", () => {
    const g = getChartGeometry(true);
    const mid = yForPct(50, g);
    expect(mid).toBe(g.padTop + g.plotHeight / 2);
  });

  it("leaves pct label Ys alone when already far enough apart", () => {
    const g = getChartGeometry(true);
    const homeY = yForPct(70, g);
    const awayY = yForPct(30, g);
    const { homeLabelY, awayLabelY } = separatePctLabelYs(
      homeY,
      awayY,
      PCT_LABEL_MIN_GAP,
      g,
    );
    expect(homeLabelY).toBe(homeY);
    expect(awayLabelY).toBe(awayY);
  });

  it("separates overlapping pct label Ys when series cross near 50%", () => {
    const g = getChartGeometry(true);
    const homeY = yForPct(51, g);
    const awayY = yForPct(49, g);
    const { homeLabelY, awayLabelY } = separatePctLabelYs(
      homeY,
      awayY,
      PCT_LABEL_MIN_GAP,
      g,
    );
    expect(Math.abs(homeLabelY - awayLabelY)).toBeGreaterThanOrEqual(
      PCT_LABEL_MIN_GAP,
    );
    expect(homeLabelY).toBeLessThan(awayLabelY);
  });
});
