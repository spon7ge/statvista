import { useEffect, useState, type MouseEvent } from "react";
import { GameSection } from "@/components/game/GameSection";
import type { MlbGameDetailView } from "./types";
import {
  buildSplitSeriesPaths,
  CHART_GEOMETRY,
  nearestIndexForClientX,
  toDisplayPct,
  xForIndex,
  yForPct,
} from "./mlbWinProbabilityPaths";

export function MlbWinProbability({ detail }: { detail: MlbGameDetailView }) {
  const data = detail.winProbability;
  const points = (data?.points ?? []).map((point) => {
    const homeWinPct = toDisplayPct(point.homeWinPct);
    return {
      ...point,
      homeWinPct,
      awayWinPct: 100 - homeWinPct,
    };
  });
  const [activeIndex, setActiveIndex] = useState(
    Math.max(points.length - 1, 0),
  );

  useEffect(() => {
    setActiveIndex(Math.max((data?.points.length ?? 0) - 1, 0));
  }, [data]);

  if (!data) {
    return (
      <GameSection className="!p-3" data-testid="mlb-game-flow">
        <h2 className="text-base font-semibold text-white">Game flow</h2>
        <p className="mt-1.5 text-sm text-white/50">
          Win probability unavailable
        </p>
      </GameSection>
    );
  }

  const scrub = Math.min(
    Math.max(activeIndex, 0),
    Math.max(points.length - 1, 0),
  );
  const paths = buildSplitSeriesPaths(points, scrub);
  const activePoint =
    points.length > 0 ? (points[scrub] ?? points[points.length - 1]) : null;
  const midY = yForPct(50);

  const vividProps = {
    fill: "none" as const,
    strokeWidth: 1.5,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    "data-wp-segment": "vivid",
  };
  const mutedProps = {
    fill: "none" as const,
    strokeWidth: 1.5,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    stroke: "rgba(255,255,255,0.28)",
    opacity: 0.35,
    "data-wp-segment": "muted",
  };

  function handleChartPointerMove(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveIndex(nearestIndexForClientX(event.clientX, rect, points.length));
  }

  const scrubX = xForIndex(scrub, points.length);
  const atEnd = points.length === 0 || scrub >= points.length - 1;
  const labelX = scrubX + 8;
  const labelAnchor = "start" as const;

  const homeY = activePoint ? yForPct(activePoint.homeWinPct) : 0;
  const awayY = activePoint ? yForPct(activePoint.awayWinPct) : 0;
  const topSeriesY = Math.min(homeY, awayY);
  const clockDefaultY = CHART_GEOMETRY.padTop + 12;
  const clockOverlapsPct = Boolean(activePoint) && topSeriesY < clockDefaultY + 22;
  const clockY = clockOverlapsPct ? CHART_GEOMETRY.padTop - 18 : clockDefaultY;
  const trackerTop = clockOverlapsPct ? clockY + 6 : CHART_GEOMETRY.padTop;
  const showTracker = Boolean(activePoint) && !atEnd;

  return (
    <GameSection className="!p-3" data-testid="mlb-game-flow">
      <h2 className="text-base font-semibold text-white">Game flow</h2>

      {points.length > 0 ? (
        <div className="relative mt-2">
          <svg
            aria-label="Win probability chart"
            viewBox={`0 0 ${CHART_GEOMETRY.width} ${CHART_GEOMETRY.height}`}
            className="w-full overflow-visible"
            onMouseMove={handleChartPointerMove}
          >
            <line
              x1={CHART_GEOMETRY.padLeft}
              x2={CHART_GEOMETRY.padLeft + CHART_GEOMETRY.plotWidth}
              y1={midY}
              y2={midY}
              stroke="rgba(255,255,255,0.22)"
              strokeDasharray="4 4"
            />

            {paths.awayVivid ? (
              <path
                d={paths.awayVivid}
                stroke={detail.away.color}
                {...vividProps}
              />
            ) : null}
            {paths.homeVivid ? (
              <path
                d={paths.homeVivid}
                stroke={detail.home.color}
                {...vividProps}
              />
            ) : null}
            {paths.awayMuted ? (
              <path d={paths.awayMuted} {...mutedProps} />
            ) : null}
            {paths.homeMuted ? (
              <path d={paths.homeMuted} {...mutedProps} />
            ) : null}

            {activePoint ? (
              <>
                {showTracker ? (
                  <line
                    x1={scrubX}
                    x2={scrubX}
                    y1={trackerTop}
                    y2={CHART_GEOMETRY.padTop + CHART_GEOMETRY.plotHeight}
                    stroke="rgba(255,255,255,0.45)"
                    strokeDasharray="3 3"
                    pointerEvents="none"
                  />
                ) : null}
                <circle
                  cx={scrubX}
                  cy={awayY}
                  r={4}
                  fill={detail.away.color}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
                <circle
                  cx={scrubX}
                  cy={homeY}
                  r={4}
                  fill={detail.home.color}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
                <text
                  x={labelX}
                  y={homeY}
                  fill={detail.home.color}
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {detail.home.abbrev} {Math.round(activePoint.homeWinPct)}%
                </text>
                <text
                  x={labelX}
                  y={awayY}
                  fill={detail.away.color}
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {detail.away.abbrev} {Math.round(activePoint.awayWinPct)}%
                </text>
                <text
                  x={scrubX}
                  y={clockY}
                  fill="rgba(255,255,255,0.7)"
                  textAnchor="middle"
                  data-wp-clock
                  style={{ fontSize: "12px" }}
                >
                  {activePoint.label}
                </text>
              </>
            ) : null}
          </svg>

          <input
            type="range"
            min={0}
            max={Math.max(points.length - 1, 0)}
            step={1}
            value={activeIndex}
            aria-label="Win probability timeline"
            aria-valuetext={activePoint?.label}
            className="sr-only"
            onChange={(event) => {
              setActiveIndex(Number(event.target.value));
            }}
          />
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-white/50">
          Win probability unavailable
        </p>
      )}
    </GameSection>
  );
}
