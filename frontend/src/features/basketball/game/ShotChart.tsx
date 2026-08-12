import { useMemo, useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type { GameDetail, GameDetailShot, GameDetailTeam } from "../lib/types";

/** Full court in feet × 10 (94 × 50). ESPN half-court shots: x 0–50 width, y 0–47 from basket. */
const COURT_LENGTH = 940;
const COURT_WIDTH = 500;
/** Maple hardwood + painted white lines (dark gym fill hid the court). */
export const COURT_FILL = "#c4a36a";
const LINE = "rgba(255,255,255,0.7)";
const LINE_WIDTH = 1.5;

type PeriodFilter = "all" | number;
type BasketSide = "left" | "right";

function quarterLabel(period: number): string {
  if (period <= 4) return `${period}Q`;
  const ot = period - 4;
  return ot === 1 ? "OT" : `${ot}OT`;
}

/** Map ESPN half-court (x,y) onto one end of a landscape full court. */
export function toFullCourtPoint(
  shot: Pick<GameDetailShot, "x" | "y">,
  side: BasketSide,
): { cx: number; cy: number } {
  const cy = shot.x * 10;
  const along = shot.y * 10;
  const cx = side === "left" ? along : COURT_LENGTH - along;
  return { cx, cy };
}

function TeamLogo({
  team,
  x,
  y,
}: {
  team: GameDetailTeam;
  x: number;
  y: number;
}) {
  if (!team.logoUrl) return null;
  const size = 48;
  return (
    <image
      href={team.logoUrl}
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      opacity={0.9}
      aria-hidden
    />
  );
}

/** Paint + rim + 3PT for one basket end. */
function BasketEnd({ side }: { side: BasketSide }) {
  const mirror = (x: number) => (side === "left" ? x : COURT_LENGTH - x);
  const paintLeft = mirror(0);
  const paintRight = mirror(190);
  const paintX = Math.min(paintLeft, paintRight);
  const ftX = mirror(190);
  const rimX = mirror(52.5);
  const boardX = mirror(40);
  const restrictY1 = 210;
  const restrictY2 = 290;
  const baseline = mirror(0);
  const cornerDepth = mirror(140);
  const arcStartY = 33;
  const arcEndY = 467;

  // 3PT: sideline corners from baseline, then arc around the rim.
  const threePath =
    side === "left"
      ? `M ${baseline} ${arcStartY}
         L ${cornerDepth} ${arcStartY}
         A 237 237 0 0 1 ${cornerDepth} ${arcEndY}
         L ${baseline} ${arcEndY}`
      : `M ${baseline} ${arcStartY}
         L ${cornerDepth} ${arcStartY}
         A 237 237 0 0 0 ${cornerDepth} ${arcEndY}
         L ${baseline} ${arcEndY}`;

  return (
    <g>
      <rect
        x={paintX}
        y={170}
        width={190}
        height={160}
        fill="none"
        stroke={LINE}
        strokeWidth={LINE_WIDTH}
      />
      <line
        x1={ftX}
        y1={170}
        x2={ftX}
        y2={330}
        stroke={LINE}
        strokeWidth={LINE_WIDTH}
      />
      {/* Free-throw circle toward midcourt (solid) + back half dashed */}
      <path
        d={
          side === "left"
            ? `M ${ftX} 190 A 60 60 0 0 1 ${ftX} 310`
            : `M ${ftX} 190 A 60 60 0 0 0 ${ftX} 310`
        }
        fill="none"
        stroke={LINE}
        strokeWidth={LINE_WIDTH}
      />
      <path
        d={
          side === "left"
            ? `M ${ftX} 190 A 60 60 0 0 0 ${ftX} 310`
            : `M ${ftX} 190 A 60 60 0 0 1 ${ftX} 310`
        }
        fill="none"
        stroke={LINE}
        strokeWidth={LINE_WIDTH}
        strokeDasharray="6 6"
      />
      <path
        d={
          side === "left"
            ? `M ${rimX} ${restrictY1} A 40 40 0 0 1 ${rimX} ${restrictY2}`
            : `M ${rimX} ${restrictY1} A 40 40 0 0 0 ${rimX} ${restrictY2}`
        }
        fill="none"
        stroke={LINE}
        strokeWidth={LINE_WIDTH}
      />
      <line
        x1={boardX}
        y1={220}
        x2={boardX}
        y2={280}
        stroke={LINE}
        strokeWidth={2}
      />
      <circle
        cx={rimX}
        cy={250}
        r={7.5}
        fill="none"
        stroke={LINE}
        strokeWidth={LINE_WIDTH}
      />
      <path
        d={threePath}
        fill="none"
        stroke={LINE}
        strokeWidth={LINE_WIDTH}
      />
    </g>
  );
}

function FullCourtMarkings() {
  return (
    <g aria-hidden>
      <rect
        x={0}
        y={0}
        width={COURT_LENGTH}
        height={COURT_WIDTH}
        rx={8}
        fill={COURT_FILL}
        stroke={LINE}
        strokeWidth={LINE_WIDTH}
      />
      <line
        x1={COURT_LENGTH / 2}
        y1={0}
        x2={COURT_LENGTH / 2}
        y2={COURT_WIDTH}
        stroke={LINE}
        strokeWidth={LINE_WIDTH}
      />
      <circle
        cx={COURT_LENGTH / 2}
        cy={COURT_WIDTH / 2}
        r={60}
        fill="none"
        stroke={LINE}
        strokeWidth={LINE_WIDTH}
      />
      <BasketEnd side="left" />
      <BasketEnd side="right" />
    </g>
  );
}

export function ShotChart({ detail }: { detail: GameDetail }) {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

  const periods = useMemo(() => {
    const set = new Set(detail.shots.map((shot) => shot.period));
    for (const play of detail.plays) set.add(play.period);
    return Array.from(set)
      .filter((p) => p > 0)
      .sort((a, b) => a - b);
  }, [detail.shots, detail.plays]);

  const visibleShots = detail.shots.filter((shot) => {
    if (periodFilter !== "all" && shot.period !== periodFilter) return false;
    return true;
  });

  const awayShots = visibleShots.filter((s) => s.teamId === detail.away.id);
  const homeShots = visibleShots.filter((s) => s.teamId === detail.home.id);
  const awayFgm = awayShots.filter((s) => s.made).length;
  const homeFgm = homeShots.filter((s) => s.made).length;
  const awayFga = awayShots.length;
  const homeFga = homeShots.length;

  function teamColor(teamId: string): string {
    if (teamId === detail.away.id) return detail.away.color;
    if (teamId === detail.home.id) return detail.home.color;
    return "#9ca3af";
  }

  function sideForTeam(teamId: string): BasketSide {
    return teamId === detail.home.id ? "right" : "left";
  }

  const periodFilters: { value: PeriodFilter; label: string }[] = [
    { value: "all", label: "All" },
    ...periods.map((period) => ({
      value: period as PeriodFilter,
      label: quarterLabel(period),
    })),
  ];

  return (
    <GameSection className="!p-3" data-testid="wnba-shot-chart">
      <h2 className="sr-only">Shot chart</h2>

      <div className="mb-3 flex justify-center">
        <div
          className="flex rounded-full bg-white/10 p-1"
          role="group"
          aria-label="Period filter"
        >
          {periodFilters.map((f) => (
            <button
              key={String(f.value)}
              type="button"
              onClick={() => setPeriodFilter(f.value)}
              aria-pressed={periodFilter === f.value}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                periodFilter === f.value
                  ? "bg-white text-black"
                  : "text-white/80 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${COURT_LENGTH} ${COURT_WIDTH}`}
        className="mx-auto block w-full max-w-full"
        role="img"
        aria-label="Full-court shot chart"
      >
        <FullCourtMarkings />

        <TeamLogo team={detail.away} x={COURT_LENGTH / 2 - 40} y={56} />
        <TeamLogo team={detail.home} x={COURT_LENGTH / 2 + 40} y={56} />

        {visibleShots.map((shot) => {
          const color = teamColor(shot.teamId);
          const { cx, cy } = toFullCourtPoint(shot, sideForTeam(shot.teamId));
          return (
            <circle
              key={shot.id}
              role="img"
              aria-label={`${shot.playerName} ${shot.made ? "made" : "missed"} shot`}
              cx={cx}
              cy={cy}
              r={7}
              fill={shot.made ? color : "none"}
              stroke={color}
              strokeWidth={1.75}
              opacity={shot.made ? 0.95 : 0.85}
            />
          );
        })}
      </svg>

      <div className="mt-2 flex items-center justify-between text-[13px] font-medium tabular-nums text-white">
        <span>
          {detail.away.abbrev} {awayFgm}/{awayFga}
        </span>
        <span>
          {detail.home.abbrev} {homeFgm}/{homeFga}
        </span>
      </div>
    </GameSection>
  );
}
