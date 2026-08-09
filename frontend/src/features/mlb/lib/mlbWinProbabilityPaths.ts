export type ChartGeometry = {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  plotWidth: number;
  plotHeight: number;
  yLabelX: number;
};

const PAD_LEFT = 20;
const PAD_RIGHT = 72;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;
const WIDTH = 640;

function buildGeometry(height: number): ChartGeometry {
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  return {
    width: WIDTH,
    height,
    padLeft: PAD_LEFT,
    padRight: PAD_RIGHT,
    padTop: PAD_TOP,
    padBottom: PAD_BOTTOM,
    plotWidth,
    plotHeight,
    yLabelX: PAD_LEFT - 8,
  };
}

export const CHART_GEOMETRY = buildGeometry(520);
/** Dense rail height — keeps home/away WP lines visually close. */
export const COMPACT_CHART_GEOMETRY = buildGeometry(168);

export function getChartGeometry(compact = false): ChartGeometry {
  return compact ? COMPACT_CHART_GEOMETRY : CHART_GEOMETRY;
}

export const PLOT_WIDTH = CHART_GEOMETRY.plotWidth;
export const PLOT_HEIGHT = CHART_GEOMETRY.plotHeight;

export type SeriesKey = "away" | "home";

type PctPoint = { awayWinPct: number; homeWinPct: number };

/** API stores home_win_pct as 0–1; view fixtures may already be 0–100. */
export function toDisplayPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const pct = value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, pct));
}

export function xForIndex(
  index: number,
  count: number,
  geometry: ChartGeometry = CHART_GEOMETRY,
): number {
  if (count <= 1) return geometry.padLeft + geometry.plotWidth / 2;
  return (
    geometry.padLeft + (index / (count - 1)) * geometry.plotWidth
  );
}

export function yForPct(
  pct: number,
  geometry: ChartGeometry = CHART_GEOMETRY,
): number {
  return (
    geometry.padTop +
    geometry.plotHeight -
    (pct / 100) * geometry.plotHeight
  );
}

/** Keep home/away % labels from stacking when series Ys are too close. */
export const PCT_LABEL_MIN_GAP = 22;

export function separatePctLabelYs(
  homeY: number,
  awayY: number,
  minGap: number = PCT_LABEL_MIN_GAP,
  geometry: ChartGeometry = CHART_GEOMETRY,
): { homeLabelY: number; awayLabelY: number } {
  const plotTop = geometry.padTop;
  const plotBottom = geometry.padTop + geometry.plotHeight;
  const clamp = (y: number) => Math.min(plotBottom, Math.max(plotTop, y));

  if (Math.abs(homeY - awayY) >= minGap) {
    return { homeLabelY: clamp(homeY), awayLabelY: clamp(awayY) };
  }

  const mid = (homeY + awayY) / 2;
  const half = minGap / 2;
  if (homeY <= awayY) {
    return {
      homeLabelY: clamp(mid - half),
      awayLabelY: clamp(mid + half),
    };
  }
  return {
    awayLabelY: clamp(mid - half),
    homeLabelY: clamp(mid + half),
  };
}

export function nearestIndexForClientX(
  clientX: number,
  rect: DOMRect,
  count: number,
  geometry: ChartGeometry = CHART_GEOMETRY,
): number {
  if (count <= 1) return 0;
  const plotLeft =
    rect.left + (geometry.padLeft / geometry.width) * rect.width;
  const plotWidth = (geometry.plotWidth / geometry.width) * rect.width;
  const ratio = Math.min(Math.max((clientX - plotLeft) / plotWidth, 0), 1);
  return Math.round(ratio * (count - 1));
}

export function buildSeriesPathD(
  points: PctPoint[],
  series: SeriesKey,
  fromIndex: number,
  toIndex: number,
  geometry: ChartGeometry = CHART_GEOMETRY,
): string {
  if (points.length === 0) return "";
  if (fromIndex > toIndex) return "";
  if (fromIndex < 0 || toIndex >= points.length) return "";

  const coords = [];
  for (let i = fromIndex; i <= toIndex; i++) {
    const pct =
      series === "home" ? points[i].homeWinPct : points[i].awayWinPct;
    coords.push({
      x: xForIndex(i, points.length, geometry),
      y: yForPct(pct, geometry),
    });
  }

  return coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x} ${c.y}`)
    .join(" ");
}

export function buildSplitSeriesPaths(
  points: PctPoint[],
  activeIndex: number,
  geometry: ChartGeometry = CHART_GEOMETRY,
): {
  awayVivid: string;
  awayMuted: string;
  homeVivid: string;
  homeMuted: string;
} {
  if (points.length === 0) {
    return { awayVivid: "", awayMuted: "", homeVivid: "", homeMuted: "" };
  }
  const scrub = Math.min(Math.max(activeIndex, 0), points.length - 1);
  const last = points.length - 1;
  return {
    awayVivid: buildSeriesPathD(points, "away", 0, scrub, geometry),
    homeVivid: buildSeriesPathD(points, "home", 0, scrub, geometry),
    awayMuted:
      scrub < last
        ? buildSeriesPathD(points, "away", scrub, last, geometry)
        : "",
    homeMuted:
      scrub < last
        ? buildSeriesPathD(points, "home", scrub, last, geometry)
        : "",
  };
}
