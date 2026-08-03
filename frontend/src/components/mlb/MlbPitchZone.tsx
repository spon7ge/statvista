import { GameSection } from "@/components/game/GameSection";
import type { MlbPitch, MlbSituation } from "./types";

const ZONE_CENTER_X = 50;
const ZONE_CENTER_Y = 58;
const ZONE_SCALE = 28;
const STRIKE_LEFT = 35;
const STRIKE_TOP = 28;
const STRIKE_WIDTH = 30;
const STRIKE_HEIGHT = 52;

function plotPitch(pitch: MlbPitch): { cx: number; cy: number } | null {
  if (pitch.zoneX === null || pitch.zoneY === null) return null;
  return {
    cx: ZONE_CENTER_X + pitch.zoneX * ZONE_SCALE,
    cy: ZONE_CENTER_Y - pitch.zoneY * ZONE_SCALE,
  };
}

function pitchFill(isStrike: boolean): string {
  return isStrike ? "rgba(248, 113, 113, 0.85)" : "rgba(74, 222, 128, 0.75)";
}

export function MlbPitchZone({ situation }: { situation: MlbSituation }) {
  const pitches = situation.pitches;

  return (
    <GameSection className="!p-3">
      <h2 className="mb-2 text-sm font-semibold text-white">Pitch zone</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <svg
          viewBox="0 0 100 120"
          className="mx-auto h-44 w-36 shrink-0 sm:mx-0"
          role="img"
          aria-label="Pitch strike zone"
        >
          <rect
            x={STRIKE_LEFT}
            y={STRIKE_TOP}
            width={STRIKE_WIDTH}
            height={STRIKE_HEIGHT}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.25"
          />
          <line
            x1={STRIKE_LEFT + STRIKE_WIDTH / 3}
            y1={STRIKE_TOP}
            x2={STRIKE_LEFT + STRIKE_WIDTH / 3}
            y2={STRIKE_TOP + STRIKE_HEIGHT}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.75"
          />
          <line
            x1={STRIKE_LEFT + (2 * STRIKE_WIDTH) / 3}
            y1={STRIKE_TOP}
            x2={STRIKE_LEFT + (2 * STRIKE_WIDTH) / 3}
            y2={STRIKE_TOP + STRIKE_HEIGHT}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.75"
          />
          <line
            x1={STRIKE_LEFT}
            y1={STRIKE_TOP + STRIKE_HEIGHT / 3}
            x2={STRIKE_LEFT + STRIKE_WIDTH}
            y2={STRIKE_TOP + STRIKE_HEIGHT / 3}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.75"
          />
          <line
            x1={STRIKE_LEFT}
            y1={STRIKE_TOP + (2 * STRIKE_HEIGHT) / 3}
            x2={STRIKE_LEFT + STRIKE_WIDTH}
            y2={STRIKE_TOP + (2 * STRIKE_HEIGHT) / 3}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.75"
          />
          {pitches.map((pitch) => {
            const point = plotPitch(pitch);
            if (!point) return null;
            return (
              <g key={pitch.number}>
                <circle
                  cx={point.cx}
                  cy={point.cy}
                  r={5.5}
                  fill={pitchFill(pitch.isStrike)}
                />
                <text
                  x={point.cx}
                  y={point.cy + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-black text-[7px] font-semibold"
                >
                  {pitch.number}
                </text>
              </g>
            );
          })}
        </svg>

        <ul className="min-w-0 flex-1 space-y-1 text-xs">
          {pitches.length === 0 ? (
            <li className="text-white/40">No pitches yet</li>
          ) : (
            pitches.map((pitch) => (
              <li
                key={pitch.number}
                className="flex items-baseline gap-2 text-white/70"
              >
                <span
                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-black ${
                    pitch.isStrike ? "bg-red-400/80" : "bg-green-400/70"
                  }`}
                >
                  {pitch.number}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {pitch.result ?? "Pitch"}
                  {pitch.type ? (
                    <span className="text-white/40"> · {pitch.type}</span>
                  ) : null}
                </span>
                {pitch.mph !== null ? (
                  <span className="shrink-0 font-mono text-white/45 tabular-nums">
                    {pitch.mph.toFixed(0)} mph
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </GameSection>
  );
}
