import { GameSection } from "@/shared/ui/GameSection";
import type { MlbPitch, MlbSituation } from "../lib/types";

// Normalized zone coords are [-1, 1]. Scale fills most of a tight 124×120 viewBox
// so the strike box reads large while leaving room for the plate below it.
export const ZONE_CENTER_X = 62;
export const ZONE_CENTER_Y = 46;
const ZONE_SCALE = 26;
const STRIKE_WIDTH = 44;
const STRIKE_HEIGHT = 58;
const STRIKE_LEFT = ZONE_CENTER_X - STRIKE_WIDTH / 2;
const STRIKE_TOP = ZONE_CENTER_Y - STRIKE_HEIGHT / 2;
const PLATE_CENTER_X = ZONE_CENTER_X;
const PLATE_TOP = STRIKE_TOP + STRIKE_HEIGHT + 20;

function plotPitch(pitch: MlbPitch): { cx: number; cy: number } | null {
  if (pitch.zoneX === null || pitch.zoneY === null) return null;
  return {
    cx: ZONE_CENTER_X + pitch.zoneX * ZONE_SCALE,
    cy: ZONE_CENTER_Y - pitch.zoneY * ZONE_SCALE,
  };
}

function pitchFill(isStrike: boolean): string {
  return isStrike ? "rgba(248, 113, 113, 0.9)" : "rgba(74, 222, 128, 0.9)";
}

function SpinLine({ pitch }: { pitch: MlbPitch }) {
  if (pitch.spinRate == null && pitch.spinDirection == null) return null;
  const parts: string[] = [];
  if (pitch.spinRate != null) parts.push(`${Math.round(pitch.spinRate)} rpm`);
  if (pitch.spinDirection != null)
    parts.push(`${Math.round(pitch.spinDirection)} deg`);
  return <p className="text-[11px] text-white/45">Spin: {parts.join(", ")}</p>;
}

function PitchNumberDot({ pitch }: { pitch: MlbPitch }) {
  return (
    <span
      className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black ${
        pitch.isStrike ? "bg-red-400/90" : "bg-green-400/90"
      }`}
    >
      {pitch.number}
    </span>
  );
}

function PitchFooterCard({ pitch }: { pitch: MlbPitch }) {
  return (
    <li className="min-w-0 space-y-0.5 px-2 py-1.5 text-xs even:border-l even:border-white/10">
      <p className="flex items-center gap-1.5 font-semibold text-white">
        <PitchNumberDot pitch={pitch} />
        <span className="truncate">{pitch.result ?? "Pitch"}</span>
      </p>
      <p className="text-white/60">
        {pitch.mph !== null ? (
          <span className="font-mono tabular-nums">
            {pitch.mph.toFixed(1)} mph
          </span>
        ) : null}
        {pitch.mph !== null && pitch.type ? " " : null}
        {pitch.type ?? null}
      </p>
      <SpinLine pitch={pitch} />
    </li>
  );
}

/** Simple static silhouette of a right-handed batter mid-swing; hand-agnostic for v1. */
function BatterSilhouette() {
  return (
    <svg
      viewBox="0 0 100 140"
      className="h-auto w-16 shrink-0 sm:w-20"
      role="img"
      aria-label="Batter silhouette"
      data-testid="mlb-pitch-zone-batter-silhouette"
    >
      <g fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5">
        <circle cx="52" cy="18" r="11" />
        <path d="M41 12 q11 -10 22 0 l-2 6 q-9 -6 -18 0 z" />
        <path d="M46 27 q6 6 12 0 l3 12 q-9 5 -18 0 z" />
        <path d="M40 34 q4 -3 8 -1 l14 -20 q4 -3 7 1 l3 4 q2 4 -2 6 l-15 18 q-2 3 -6 2 l-10 -4 q-3 -2 -1 -5 z" />
        <path d="M42 39 q10 6 22 0 l6 26 q1 8 -3 14 l-4 20 q-1 4 -5 4 h-4 q-3 0 -3 -4 l1 -20 -4 -18 -4 18 2 20 q0 4 -3 4 h-4 q-4 0 -5 -4 l-3 -20 q-4 -6 -3 -14 z" />
        <path d="M31 96 l7 2 -2 8 q-1 3 -4 3 h-8 q-3 0 -2 -3 z" />
        <path d="M55 118 l7 2 -1 8 q-1 3 -4 3 h-8 q-3 0 -2 -3 z" />
      </g>
    </svg>
  );
}

export function MlbPitchZone({ situation }: { situation: MlbSituation }) {
  const pitches = situation.pitches;

  return (
    <GameSection className="!p-2.5" data-testid="mlb-pitch-zone">
      <div className="flex items-center justify-center gap-2">
        <BatterSilhouette />
        <svg
          viewBox="0 0 124 120"
          className="aspect-[124/120] w-full max-w-[16rem]"
          role="img"
          aria-label="Pitch strike zone"
          data-testid="mlb-pitch-zone-svg"
        >
          <rect
            x={STRIKE_LEFT}
            y={STRIKE_TOP}
            width={STRIKE_WIDTH}
            height={STRIKE_HEIGHT}
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.5"
          />
          <line
            x1={STRIKE_LEFT + STRIKE_WIDTH / 3}
            y1={STRIKE_TOP}
            x2={STRIKE_LEFT + STRIKE_WIDTH / 3}
            y2={STRIKE_TOP + STRIKE_HEIGHT}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.75"
          />
          <line
            x1={STRIKE_LEFT + (2 * STRIKE_WIDTH) / 3}
            y1={STRIKE_TOP}
            x2={STRIKE_LEFT + (2 * STRIKE_WIDTH) / 3}
            y2={STRIKE_TOP + STRIKE_HEIGHT}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.75"
          />
          <line
            x1={STRIKE_LEFT}
            y1={STRIKE_TOP + STRIKE_HEIGHT / 3}
            x2={STRIKE_LEFT + STRIKE_WIDTH}
            y2={STRIKE_TOP + STRIKE_HEIGHT / 3}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.75"
          />
          <line
            x1={STRIKE_LEFT}
            y1={STRIKE_TOP + (2 * STRIKE_HEIGHT) / 3}
            x2={STRIKE_LEFT + STRIKE_WIDTH}
            y2={STRIKE_TOP + (2 * STRIKE_HEIGHT) / 3}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.75"
          />

          <path
            d={`M ${PLATE_CENTER_X - 11} ${PLATE_TOP}
                h 22
                v 6
                l -11 8
                l -11 -8
                z`}
            fill="rgba(255,255,255,0.85)"
          />

          {pitches.map((pitch) => {
            const point = plotPitch(pitch);
            if (!point) return null;
            return (
              <g key={pitch.number}>
                <circle
                  cx={point.cx}
                  cy={point.cy}
                  r={6}
                  fill={pitchFill(pitch.isStrike)}
                  data-testid="mlb-pitch-marker"
                />
                <text
                  x={point.cx}
                  y={point.cy + 0.4}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-black text-[8px] font-bold"
                >
                  {pitch.number}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="mt-2 grid grid-cols-2 border-t border-white/10 pt-1.5">
        {pitches.length === 0 ? (
          <li className="col-span-2 py-1.5 text-center text-xs text-white/40">
            No pitches yet
          </li>
        ) : (
          pitches.map((pitch) => (
            <PitchFooterCard key={pitch.number} pitch={pitch} />
          ))
        )}
      </ul>
    </GameSection>
  );
}
