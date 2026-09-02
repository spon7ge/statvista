import { useEffect, useState, type MouseEvent } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import {
  FLOW_AWAY,
  FLOW_HOME,
  FLOW_MUTED,
  FLOW_RULE,
} from "@/shared/ui/GameFlowNeon";
import type { MlbGameDetailView } from "../lib/types";
import {
  buildSplitSeriesPaths,
  getChartGeometry,
  nearestIndexForClientX,
  separatePctLabelYs,
  toDisplayPct,
  xForIndex,
  yForPct,
} from "../lib/mlbWinProbabilityPaths";

export function MlbWinProbability({
  detail,
  compact = false,
}: {
  detail: MlbGameDetailView;
  compact?: boolean;
}) {
  const geometry = getChartGeometry(compact);
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
  const homeStroke = FLOW_HOME;
  const awayStroke = FLOW_AWAY;

  useEffect(() => {
    setActiveIndex(Math.max((data?.points.length ?? 0) - 1, 0));
  }, [data]);

  if (!data) {
    return (
      <GameSection className="!p-3" data-testid="mlb-game-flow">
        <h2 className="font-semibold text-c3">Game flow</h2>
        <p className="mt-1.5 text-[16px] text-c3">
          Win probability unavailable
        </p>
      </GameSection>
    );
  }

  const scrub = Math.min(
    Math.max(activeIndex, 0),
    Math.max(points.length - 1, 0),
  );
  const paths = buildSplitSeriesPaths(points, scrub, geometry);
  const activePoint =
    points.length > 0 ? (points[scrub] ?? points[points.length - 1]) : null;
  const midY = yForPct(50, geometry);

  const vividProps = {
    fill: "none" as const,
    strokeWidth: 1.5,
    strokeLinejoin: "miter" as const,
    strokeLinecap: "butt" as const,
    "data-wp-segment": "vivid",
  };
  const mutedProps = {
    fill: "none" as const,
    strokeWidth: 1.5,
    strokeLinejoin: "miter" as const,
    strokeLinecap: "butt" as const,
    stroke: FLOW_MUTED,
    "data-wp-segment": "muted",
  };

  function handleChartPointerMove(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveIndex(
      nearestIndexForClientX(event.clientX, rect, points.length, geometry),
    );
  }

  const scrubX = xForIndex(scrub, points.length, geometry);
  const atEnd = points.length === 0 || scrub >= points.length - 1;
  const labelX = scrubX + 8;
  const labelAnchor = "start" as const;

  const homeY = activePoint ? yForPct(activePoint.homeWinPct, geometry) : 0;
  const awayY = activePoint ? yForPct(activePoint.awayWinPct, geometry) : 0;
  const { homeLabelY, awayLabelY } = activePoint
    ? separatePctLabelYs(homeY, awayY, undefined, geometry)
    : { homeLabelY: 0, awayLabelY: 0 };
  const topLabelY = Math.min(homeLabelY, awayLabelY);
  const clockDefaultY = geometry.padTop + 12;
  const clockOverlapsPct = Boolean(activePoint) && topLabelY < clockDefaultY + 22;
  const clockY = clockOverlapsPct ? geometry.padTop - 18 : clockDefaultY;
  const trackerTop = clockOverlapsPct ? clockY + 6 : geometry.padTop;
  const showTracker = Boolean(activePoint) && !atEnd;

  return (
    <GameSection className="!p-3" data-testid="mlb-game-flow">
      <h2 className="font-semibold text-c3">Game flow</h2>

      {points.length > 0 ? (
        <div className="relative mt-2">
          <svg
            aria-label="Win probability chart"
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="w-full overflow-visible"
            onMouseMove={handleChartPointerMove}
          >
            <line
              x1={geometry.padLeft}
              x2={geometry.padLeft + geometry.plotWidth}
              y1={midY}
              y2={midY}
              stroke={FLOW_RULE}
              strokeDasharray="4 4"
            />

            {paths.awayVivid ? (
              <path
                d={paths.awayVivid}
                stroke={awayStroke}
                {...vividProps}
              />
            ) : null}
            {paths.homeVivid ? (
              <path
                d={paths.homeVivid}
                stroke={homeStroke}
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
                    y2={geometry.padTop + geometry.plotHeight}
                    stroke={FLOW_RULE}
                    strokeDasharray="3 3"
                    pointerEvents="none"
                  />
                ) : null}
                <circle
                  cx={scrubX}
                  cy={awayY}
                  r={4}
                  fill={awayStroke}
                  stroke="var(--c1)"
                  strokeWidth={1.5}
                  pointerEvents="none"
                  
                />
                <circle
                  cx={scrubX}
                  cy={homeY}
                  r={4}
                  fill={homeStroke}
                  stroke="var(--c1)"
                  strokeWidth={1.5}
                  pointerEvents="none"
                  
                />
                <text
                  x={labelX}
                  y={homeLabelY}
                  fill="var(--c3)"
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  data-testid="mlb-game-flow-home-pct"
                  style={{ fontSize: "16px", fontWeight: 600 }}
                >
                  {detail.home.abbrev} {Math.round(activePoint.homeWinPct)}%
                </text>
                <text
                  x={labelX}
                  y={awayLabelY}
                  fill="var(--c3)"
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  data-testid="mlb-game-flow-away-pct"
                  style={{ fontSize: "16px", fontWeight: 600 }}
                >
                  {detail.away.abbrev} {Math.round(activePoint.awayWinPct)}%
                </text>
                <text
                  x={scrubX}
                  y={clockY}
                  fill="var(--c3)"
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
        <p className="mt-1.5 text-[16px] text-c3">
          Win probability unavailable
        </p>
      )}
    </GameSection>
  );
}
