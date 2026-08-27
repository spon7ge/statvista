import { useEffect, useId, useState, type MouseEvent } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import {
  GameFlowNeonFilter,
  NeonFilamentPath,
  NeonHaloPath,
  neonGlowColor,
  neonMarkerStyle,
  shouldNeonGameFlow,
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
  const reactId = useId();
  const neonFilterId = `wp-neon-${reactId.replace(/:/g, "")}`;
  const showNeon = shouldNeonGameFlow(detail.status);
  const pulseNeon = showNeon && detail.status !== "final";
  const homeStroke = showNeon
    ? neonGlowColor(detail.home.color)
    : detail.home.color;
  const awayStroke = showNeon
    ? neonGlowColor(detail.away.color)
    : detail.away.color;

  useEffect(() => {
    setActiveIndex(Math.max((data?.points.length ?? 0) - 1, 0));
  }, [data]);

  if (!data) {
    return (
      <GameSection className="!p-3" data-testid="mlb-game-flow">
        <h2 className="font-semibold text-white">Game flow</h2>
        <p className="mt-1.5 text-[18px] text-white/50">
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
    strokeWidth: showNeon ? (compact ? 2.25 : 2) : compact ? 2 : 1.5,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    "data-wp-segment": "vivid",
  };
  const mutedProps = {
    fill: "none" as const,
    strokeWidth: compact ? 2 : 1.5,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    stroke: "rgba(255,255,255,0.28)",
    opacity: 0.35,
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
      <h2 className="font-semibold text-white">Game flow</h2>

      {points.length > 0 ? (
        <div className="relative mt-2">
          <svg
            aria-label="Win probability chart"
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="w-full overflow-visible"
            onMouseMove={handleChartPointerMove}
          >
            {showNeon ? (
              <defs>
                <GameFlowNeonFilter id={neonFilterId} />
              </defs>
            ) : null}
            <line
              x1={geometry.padLeft}
              x2={geometry.padLeft + geometry.plotWidth}
              y1={midY}
              y2={midY}
              stroke="rgba(255,255,255,0.22)"
              strokeDasharray="4 4"
            />

            {showNeon && paths.awayVivid ? (
              <NeonHaloPath
                d={paths.awayVivid}
                stroke={awayStroke}
                filterId={neonFilterId}
                pulse={pulseNeon}
              />
            ) : null}
            {showNeon && paths.homeVivid ? (
              <NeonHaloPath
                d={paths.homeVivid}
                stroke={homeStroke}
                filterId={neonFilterId}
                pulse={pulseNeon}
              />
            ) : null}
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
            {showNeon && paths.awayVivid ? (
              <NeonFilamentPath d={paths.awayVivid} />
            ) : null}
            {showNeon && paths.homeVivid ? (
              <NeonFilamentPath d={paths.homeVivid} />
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
                    stroke="rgba(255,255,255,0.45)"
                    strokeDasharray="3 3"
                    pointerEvents="none"
                  />
                ) : null}
                <circle
                  cx={scrubX}
                  cy={awayY}
                  r={4}
                  fill={awayStroke}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  pointerEvents="none"
                  style={showNeon ? neonMarkerStyle(awayStroke) : undefined}
                />
                <circle
                  cx={scrubX}
                  cy={homeY}
                  r={4}
                  fill={homeStroke}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  pointerEvents="none"
                  style={showNeon ? neonMarkerStyle(homeStroke) : undefined}
                />
                <text
                  x={labelX}
                  y={homeLabelY}
                  fill="#FFFFFF"
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  data-testid="mlb-game-flow-home-pct"
                  style={{ fontSize: "18px", fontWeight: 600 }}
                >
                  {detail.home.abbrev} {Math.round(activePoint.homeWinPct)}%
                </text>
                <text
                  x={labelX}
                  y={awayLabelY}
                  fill="#FFFFFF"
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  data-testid="mlb-game-flow-away-pct"
                  style={{ fontSize: "18px", fontWeight: 600 }}
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
        <p className="mt-1.5 text-[18px] text-white/50">
          Win probability unavailable
        </p>
      )}
    </GameSection>
  );
}
