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
import type { GameDetail } from "../lib/types";
import {
  buildSplitSeriesPaths,
  CHART_GEOMETRY,
  nearestIndexForClientX,
  separatePctLabelYs,
  xForIndex,
  yForPct,
} from "../lib/winProbabilityPaths";

export function WinProbabilityPanel({ detail }: { detail: GameDetail }) {
  const data = detail.winProbability;
  const points = data?.timeline ?? [];
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
    setActiveIndex(Math.max((data?.timeline.length ?? 0) - 1, 0));
  }, [data]);

  if (!data) {
    return (
      <GameSection className="!p-3" data-testid="wnba-game-flow">
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
  const paths = buildSplitSeriesPaths(points, scrub);
  const activePoint =
    points.length > 0 ? (points[scrub] ?? points[points.length - 1]) : null;
  const midY = yForPct(50);

  const vividProps = {
    fill: "none" as const,
    strokeWidth: showNeon ? 2 : 1.5,
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
  // Keep win-% labels on the right of the scrub point.
  const labelX = scrubX + 8;
  const labelAnchor = "start" as const;

  const homeY = activePoint ? yForPct(activePoint.homeWinPct) : 0;
  const awayY = activePoint ? yForPct(activePoint.awayWinPct) : 0;
  const { homeLabelY, awayLabelY } = activePoint
    ? separatePctLabelYs(homeY, awayY)
    : { homeLabelY: 0, awayLabelY: 0 };
  const topLabelY = Math.min(homeLabelY, awayLabelY);
  const clockDefaultY = CHART_GEOMETRY.padTop + 10;
  // When a high win-% label sits near the clock, lift the clock and extend
  // the tracker upward so time and % don't stack on the same spot.
  const clockOverlapsPct =
    Boolean(activePoint) && topLabelY < clockDefaultY + 22;
  const clockY = clockOverlapsPct ? CHART_GEOMETRY.padTop - 16 : clockDefaultY;
  const trackerTop = clockOverlapsPct ? clockY + 6 : CHART_GEOMETRY.padTop;
  // No full-height guide on the right edge — it reads as a Y-axis.
  const showTracker = Boolean(activePoint) && !atEnd;

  return (
    <GameSection className="!p-3" data-testid="wnba-game-flow">
      <h2 className="font-semibold text-c3">Game flow</h2>

      {points.length > 0 ? (
        <div className="relative mt-2">
          <svg
            aria-label="Win probability chart"
            viewBox={`0 0 ${CHART_GEOMETRY.width} ${CHART_GEOMETRY.height}`}
            className="w-full overflow-visible"
            onMouseMove={handleChartPointerMove}
          >
            {showNeon ? (
              <defs>
                <GameFlowNeonFilter id={neonFilterId} />
              </defs>
            ) : null}
            <line
              x1={CHART_GEOMETRY.padLeft}
              x2={CHART_GEOMETRY.padLeft + CHART_GEOMETRY.plotWidth}
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
                  fill={awayStroke}
                  stroke="var(--white)"
                  strokeWidth={1.5}
                  pointerEvents="none"
                  style={showNeon ? neonMarkerStyle(awayStroke) : undefined}
                />
                <circle
                  cx={scrubX}
                  cy={homeY}
                  r={4}
                  fill={homeStroke}
                  stroke="var(--white)"
                  strokeWidth={1.5}
                  pointerEvents="none"
                  style={showNeon ? neonMarkerStyle(homeStroke) : undefined}
                />
                <text
                  x={labelX}
                  y={homeLabelY}
                  fill="var(--c3)"
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  data-testid="wnba-game-flow-home-pct"
                  style={{ fontSize: "16px", fontWeight: 600 }}
                >
                  {detail.home.abbrev} {activePoint.homeWinPct}%
                </text>
                <text
                  x={labelX}
                  y={awayLabelY}
                  fill="var(--c3)"
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  data-testid="wnba-game-flow-away-pct"
                  style={{ fontSize: "16px", fontWeight: 600 }}
                >
                  {detail.away.abbrev} {activePoint.awayWinPct}%
                </text>
                <text
                  x={scrubX}
                  y={clockY}
                  fill="var(--c3)"
                  textAnchor="middle"
                  data-wp-clock
                  style={{ fontSize: "12px" }}
                >
                  {`Q${activePoint.period} ${activePoint.clock}`}
                </text>
              </>
            ) : null}
          </svg>

          <input
            type="range"
            min={0}
            max={points.length - 1}
            step={1}
            value={activeIndex}
            aria-label="Win probability timeline"
            aria-valuetext={
              activePoint
                ? `Q${activePoint.period} ${activePoint.clock}`
                : undefined
            }
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
