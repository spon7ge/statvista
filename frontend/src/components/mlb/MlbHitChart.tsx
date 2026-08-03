import { useState } from "react";
import { GameSection } from "@/components/game/GameSection";
import type { MlbGameDetailView, MlbHitPoint } from "./types";

type TeamFilter = "both" | "away" | "home";

const FILTERS: { key: TeamFilter; label: string }[] = [
  { key: "both", label: "Both" },
  { key: "away", label: "Away" },
  { key: "home", label: "Home" },
];

const RESULT_STYLE: Record<
  MlbHitPoint["result"],
  { fill: string; label: string }
> = {
  hr: { fill: "#f87171", label: "HR" },
  hit: { fill: "rgba(74, 222, 128, 0.85)", label: "Hit" },
  out: { fill: "rgba(255,255,255,0.45)", label: "Out" },
};

const FIELD_SIZE = 220;

function FieldDiagram({ points }: { points: MlbHitPoint[] }) {
  return (
    <svg
      viewBox={`0 0 ${FIELD_SIZE} ${FIELD_SIZE}`}
      className="mx-auto mt-3 w-full max-w-[16rem]"
      aria-label="Hit chart field"
    >
      {/* Outfield grass */}
      <path
        d={`M ${FIELD_SIZE / 2} ${FIELD_SIZE - 18}
            L 18 95
            Q ${FIELD_SIZE / 2} 8 ${FIELD_SIZE - 18} 95
            Z`}
        fill="rgba(34,197,94,0.12)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
      />
      {/* Infield diamond */}
      <path
        d={`M ${FIELD_SIZE / 2} ${FIELD_SIZE - 28}
            L ${FIELD_SIZE / 2 - 38} ${FIELD_SIZE - 66}
            L ${FIELD_SIZE / 2} ${FIELD_SIZE - 104}
            L ${FIELD_SIZE / 2 + 38} ${FIELD_SIZE - 66}
            Z`}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
      />
      {/* Home plate marker */}
      <circle
        cx={FIELD_SIZE / 2}
        cy={FIELD_SIZE - 26}
        r={2.5}
        fill="rgba(255,255,255,0.55)"
      />

      {points.map((point) => {
        const cx = point.x * FIELD_SIZE;
        const cy = point.y * FIELD_SIZE;
        const style = RESULT_STYLE[point.result];
        return (
          <circle
            key={point.id}
            data-testid={`mlb-hit-point-${point.id}`}
            cx={cx}
            cy={cy}
            r={point.result === "hr" ? 4.5 : 3.5}
            fill={style.fill}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={0.75}
          >
            <title>
              {[point.playerName, style.label].filter(Boolean).join(" · ")}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}

export function MlbHitChart({ detail }: { detail: MlbGameDetailView }) {
  const [filter, setFilter] = useState<TeamFilter>("both");
  const filtered =
    filter === "both"
      ? detail.hitChart
      : detail.hitChart.filter((point) => point.team === filter);

  return (
    <GameSection className="!p-3" data-testid="mlb-hit-chart">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Hit chart</h2>
        <div className="flex flex-wrap items-center gap-0.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/60">
        {(Object.keys(RESULT_STYLE) as Array<MlbHitPoint["result"]>).map(
          (result) => (
            <span key={result} className="flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: RESULT_STYLE[result].fill }}
              />
              {RESULT_STYLE[result].label}
            </span>
          ),
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-3 text-xs text-white/40">No hit chart data yet</p>
      ) : (
        <FieldDiagram points={filtered} />
      )}
    </GameSection>
  );
}
