import { useMemo, useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type { MlbGameDetailView, MlbHitPoint } from "../lib/types";

type TeamFilter = "both" | "away" | "home";

const RESULT_STYLE: Record<
  MlbHitPoint["result"],
  { fill: string; label: string }
> = {
  hr: { fill: "#ff5a5a", label: "HR" },
  hit: { fill: "#3fd96a", label: "Hit" },
  out: { fill: "rgba(200,200,200,0.55)", label: "Out" },
};

/** SVG canvas — home near bottom; fair territory opens upward. */
const W = 320;
const H = 330;
const CX = W / 2;
const HOME_Y = H - 18;

/**
 * Polar convention (spray chart):
 * θ = 45° RF foul line, θ = 90° CF, θ = 135° LF foul line
 * (0° = +x / right, CCW), matching the Medium / Fangraphs style.
 */
const THETA_RF = 45;
const THETA_LF = 135;
const MAX_FT = 430;
const SCALE = (HOME_Y - 28) / MAX_FT;
/** Decorative only — enlarges dirt diamond/mound vs true 90 ft scale. */
const INFIELD_VISUAL_SCALE = 1.7;

/**
 * Generic modern park fence distance (ft) vs spray angle.
 * Piecewise linear/constant segments for a polished, non-circular outline.
 */
export function genericWallRadiusFt(thetaDeg: number): number {
  const t = Math.min(THETA_LF, Math.max(THETA_RF, thetaDeg));
  // Mirror about CF so LF/RF stay symmetric for the generic park.
  const fromCf = Math.abs(t - 90);
  if (fromCf <= 8) return 408 - fromCf * 0.35; // deep CF pocket
  if (fromCf <= 18) return 395 - (fromCf - 8) * 1.1;
  if (fromCf <= 28) return 384 - (fromCf - 18) * 2.4; // power alleys
  if (fromCf <= 38) return 360 - (fromCf - 28) * 1.6;
  return 330 + (45 - fromCf) * 0.15; // foul poles ~330
}

function polarToSvg(rFt: number, thetaDeg: number): { x: number; y: number } {
  const th = (thetaDeg * Math.PI) / 180;
  return {
    x: CX + rFt * SCALE * Math.cos(th),
    y: HOME_Y - rFt * SCALE * Math.sin(th),
  };
}

function sampleWall(
  radiusFn: (thetaDeg: number) => number,
  padFt = 0,
  steps = 96,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const theta = THETA_RF + ((THETA_LF - THETA_RF) * i) / steps;
    pts.push(polarToSvg(radiusFn(theta) + padFt, theta));
  }
  return pts;
}

function pathFromPoints(
  points: Array<{ x: number; y: number }>,
  closeToHome = false,
): string {
  if (points.length === 0) return "";
  const body = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  if (!closeToHome) return body;
  return `${body} L${CX} ${HOME_Y} Z`;
}

function closedPolygon(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return `${pathFromPoints(points, false)} Z`;
}

/** Axis-aligned corners of a diamond = perfect square rotated 45°. */
function diamondSquare(
  cx: number,
  cy: number,
  halfDiagonal: number,
): Array<{ x: number; y: number }> {
  return [
    { x: cx, y: cy + halfDiagonal }, // home
    { x: cx + halfDiagonal, y: cy }, // first
    { x: cx, y: cy - halfDiagonal }, // second
    { x: cx - halfDiagonal, y: cy }, // third
  ];
}

export function hitPointTooltip(
  point: MlbHitPoint,
  teamAbbrev: string,
): { name: string; detail: string } {
  const outcome =
    point.outcome?.trim() || RESULT_STYLE[point.result].label;
  const detail = [outcome, teamAbbrev].filter(Boolean).join(" · ");
  return {
    name: point.playerName?.trim() || "Unknown",
    detail,
  };
}

function FieldDiagram({
  points,
  teamAbbrev,
}: {
  points: MlbHitPoint[];
  teamAbbrev: (team: MlbHitPoint["team"]) => string;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const { wallPts, hrPts, infield, infieldGrass, mound, foulLf, foulRf } =
    useMemo(() => {
      const wall = sampleWall(genericWallRadiusFt, 0);
      const hr = sampleWall(genericWallRadiusFt, 28);
      const s = INFIELD_VISUAL_SCALE;
      // Geometric center of the diamond (midpoint home ↔ second @ 90√2/2 ft).
      const center = polarToSvg(63.64 * s, 90);
      const halfDiag = 63.64 * s * SCALE;
      const dirt = diamondSquare(center.x, center.y, halfDiag);
      const grass = diamondSquare(center.x, center.y, halfDiag * 0.72);
      return {
        wallPts: wall,
        hrPts: hr,
        mound: center,
        foulLf: polarToSvg(genericWallRadiusFt(THETA_LF) + 28, THETA_LF),
        foulRf: polarToSvg(genericWallRadiusFt(THETA_RF) + 28, THETA_RF),
        infield: dirt,
        infieldGrass: grass,
      };
    }, []);

  const grassD = pathFromPoints(wallPts, true);
  const hrD = pathFromPoints(hrPts, true);
  const wallStroke = pathFromPoints(wallPts, false);
  const infieldD = closedPolygon(infield);
  const infieldGrassD = closedPolygon(infieldGrass);
  const hovered = points.find((p) => p.id === hoverId) ?? null;
  const tip = hovered
    ? hitPointTooltip(hovered, teamAbbrev(hovered.team))
    : null;

  return (
    <div className="relative mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full overflow-visible"
        aria-label="Hit chart field"
        data-testid="mlb-hit-chart-field"
      >
        {/* HR territory (wall → +28 ft) */}
        <path
          d={hrD}
          fill="rgba(110, 28, 36, 0.5)"
          data-testid="mlb-hit-chart-hr-ring"
        />
        {/* Fair territory grass */}
        <path d={grassD} fill="#1a3d28" />

        {/* Foul lines to poles */}
        <line
          x1={CX}
          y1={HOME_Y}
          x2={foulLf.x}
          y2={foulLf.y}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
        />
        <line
          x1={CX}
          y1={HOME_Y}
          x2={foulRf.x}
          y2={foulRf.y}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
        />

        {/* Outfield wall from polar samples */}
        <path
          d={wallStroke}
          fill="none"
          stroke="#b94a4a"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          data-testid="mlb-hit-chart-wall"
        />

        {/* Dirt infield diamond (basepaths) */}
        <path
          d={infieldD}
          fill="#6e5538"
          stroke="rgba(160, 130, 90, 0.4)"
          strokeWidth={1}
        />

        {/* Inner infield grass (green box inside dirt diamond) */}
        <path
          d={infieldGrassD}
          fill="#2f6b3d"
          data-testid="mlb-hit-chart-infield-grass"
        />

        {/* Pitcher's mound (visually scaled; not used for hit placement) */}
        <circle cx={mound.x} cy={mound.y} r={7.5} fill="#7d6240" />

        {/* Home plate */}
        <circle
          cx={CX}
          cy={HOME_Y - 1}
          r={3.25}
          fill="rgba(255,255,255,0.78)"
        />

        {points.map((point) => {
          const style = RESULT_STYLE[point.result];
          return (
            <circle
              key={point.id}
              data-testid={`mlb-hit-point-${point.id}`}
              cx={point.x * W}
              cy={point.y * H}
              r={point.result === "hr" ? 4.25 : 3.4}
              fill={style.fill}
              stroke="rgba(0,0,0,0.45)"
              strokeWidth={0.65}
              className="cursor-pointer"
              onMouseEnter={() => setHoverId(point.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(point.id)}
              onBlur={() => setHoverId(null)}
              tabIndex={0}
            />
          );
        })}
      </svg>

      {hovered && tip ? (
        <div
          role="tooltip"
          data-testid="mlb-hit-chart-tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-black/90 px-2.5 py-1.5 text-left shadow-lg"
          style={{
            left: `${hovered.x * 100}%`,
            top: `${hovered.y * 100}%`,
            marginTop: "-10px",
          }}
        >
          <p className="text-[15px] font-semibold leading-tight text-white">
            {tip.name}
          </p>
          <p className="mt-0.5 text-[13px] leading-tight text-white/70">
            {tip.detail}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function MlbHitChart({ detail }: { detail: MlbGameDetailView }) {
  const [filter, setFilter] = useState<TeamFilter>("both");
  const filters: { key: TeamFilter; label: string }[] = [
    { key: "both", label: "Both" },
    { key: "away", label: detail.away.abbrev || "Away" },
    { key: "home", label: detail.home.abbrev || "Home" },
  ];
  const filtered =
    filter === "both"
      ? detail.hitChart
      : detail.hitChart.filter((point) => point.team === filter);

  return (
    <GameSection className="!p-3 min-w-0" data-testid="mlb-hit-chart">
      <h2 className="text-[18px] font-semibold text-white">Hit chart</h2>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div
          className="inline-flex items-center rounded-full bg-black/40 p-0.5"
          role="group"
          aria-label="Hit chart team filter"
        >
          {filters.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1 text-[18px] font-medium transition-colors ${
                  active
                    ? "bg-[#6e2a32] text-white"
                    : "text-white/55 hover:text-white/85"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[18px] text-white/65">
          {(Object.keys(RESULT_STYLE) as Array<MlbHitPoint["result"]>).map(
            (result) => (
              <span key={result} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: RESULT_STYLE[result].fill }}
                />
                {RESULT_STYLE[result].label}
              </span>
            ),
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-[18px] text-white/40">No hit chart data yet</p>
      ) : (
        <FieldDiagram
          points={filtered}
          teamAbbrev={(team) =>
            team === "away"
              ? detail.away.abbrev || "Away"
              : detail.home.abbrev || "Home"
          }
        />
      )}

      <p className="mt-2 text-[18px] leading-snug text-white/40">
        Wall traces this park&apos;s real outfield dimensions; the shaded ring
        past it is home-run territory.
      </p>
    </GameSection>
  );
}
