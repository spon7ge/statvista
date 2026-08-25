import { useEffect, useId, useState, type MouseEvent } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import { neonGlowColor } from "../lib/neonGlowColor";
import type { GameDetail } from "../lib/types";
import {
  buildSplitSeriesPaths,
  CHART_GEOMETRY,
  nearestIndexForClientX,
  separatePctLabelYs,
  xForIndex,
  yForPct,
} from "../lib/winProbabilityPaths";

function shouldNeonGameFlow(status: GameDetail["status"]): boolean {
  return status === "live" || status === "halftime" || status === "final";
}

function NeonHaloPath({
  d,
  stroke,
  filterId,
  pulse,
}: {
  d: string;
  stroke: string;
  filterId: string;
  pulse: boolean;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={6.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      filter={`url(#${filterId})`}
      className={pulse ? "game-flow-neon-halo" : undefined}
      pointerEvents="none"
      data-wp-segment="neon"
    />
  );
}

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
        <h2 className="text-[18px] font-semibold text-white">Game flow</h2>
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
      <h2 className="text-[18px] font-semibold text-white">Game flow</h2>

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
                <filter
                  id={neonFilterId}
                  x="-80%"
                  y="-80%"
                  width="260%"
                  height="260%"
                >
                  <feGaussianBlur
                    in="SourceGraphic"
                    stdDeviation="1.6"
                    result="tight"
                  />
                  <feGaussianBlur
                    in="SourceGraphic"
                    stdDeviation="5"
                    result="bloom"
                  />
                  <feMerge>
                    <feMergeNode in="bloom" />
                    <feMergeNode in="tight" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
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
              <path
                d={paths.awayVivid}
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={0.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                pointerEvents="none"
              />
            ) : null}
            {showNeon && paths.homeVivid ? (
              <path
                d={paths.homeVivid}
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={0.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                pointerEvents="none"
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
                  fill={awayStroke}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  pointerEvents="none"
                  style={
                    showNeon
                      ? { filter: `drop-shadow(0 0 7px ${awayStroke})` }
                      : undefined
                  }
                />
                <circle
                  cx={scrubX}
                  cy={homeY}
                  r={4}
                  fill={homeStroke}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  pointerEvents="none"
                  style={
                    showNeon
                      ? { filter: `drop-shadow(0 0 7px ${homeStroke})` }
                      : undefined
                  }
                />
                <text
                  x={labelX}
                  y={homeLabelY}
                  fill="#FFFFFF"
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  data-testid="wnba-game-flow-home-pct"
                  style={{ fontSize: "18px", fontWeight: 600 }}
                >
                  {detail.home.abbrev} {activePoint.homeWinPct}%
                </text>
                <text
                  x={labelX}
                  y={awayLabelY}
                  fill="#FFFFFF"
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  data-testid="wnba-game-flow-away-pct"
                  style={{ fontSize: "18px", fontWeight: 600 }}
                >
                  {detail.away.abbrev} {activePoint.awayWinPct}%
                </text>
                <text
                  x={scrubX}
                  y={clockY}
                  fill="rgba(255,255,255,0.7)"
                  textAnchor="middle"
                  data-wp-clock
                  style={{ fontSize: "10px" }}
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
        <p className="mt-1.5 text-[18px] text-white/50">
          Win probability unavailable
        </p>
      )}
    </GameSection>
  );
}
