import { GameSection } from "@/shared/ui/GameSection";
import type { MlbPitch, MlbSituation } from "../lib/types";

// Backend maps Gameday coords so the strike zone is the unit square [-1, 1]²
// (x right, y up). The drawn box must match that square exactly.
export const ZONE_CENTER_X = 62;
export const ZONE_CENTER_Y = 60;
export const ZONE_SCALE = 40;
const STRIKE_SIZE = ZONE_SCALE * 2;
const STRIKE_LEFT = ZONE_CENTER_X - ZONE_SCALE;
const STRIKE_TOP = ZONE_CENTER_Y - ZONE_SCALE;
/** Just outside the unit square so ball markers clear the stroke. */
const BALL_OUTSIDE = 1.08;

function ensureBallOutsideZone(
  zoneX: number,
  zoneY: number,
): { x: number; y: number } {
  const ax = Math.abs(zoneX);
  const ay = Math.abs(zoneY);
  const chebyshev = Math.max(ax, ay);
  if (chebyshev > 1) return { x: zoneX, y: zoneY };
  if (chebyshev < 1e-6) return { x: 0, y: -BALL_OUTSIDE };
  const scale = BALL_OUTSIDE / chebyshev;
  return { x: zoneX * scale, y: zoneY * scale };
}

function plotPitch(pitch: MlbPitch): { cx: number; cy: number } | null {
  if (pitch.zoneX === null || pitch.zoneY === null) return null;
  let x = pitch.zoneX;
  let y = pitch.zoneY;
  // Called balls that land geometrically in the zone are nudged just outside
  // so the board never shows a green ball inside the strike box.
  if (!pitch.isStrike) {
    ({ x, y } = ensureBallOutsideZone(x, y));
  }
  return {
    cx: ZONE_CENTER_X + x * ZONE_SCALE,
    cy: ZONE_CENTER_Y - y * ZONE_SCALE,
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
  return <p className="text-[18px] text-white/45">Spin: {parts.join(", ")}</p>;
}

function PitchNumberDot({ pitch }: { pitch: MlbPitch }) {
  return (
    <span
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-black ${
        pitch.isStrike ? "bg-red-400/90" : "bg-green-400/90"
      }`}
    >
      {pitch.number}
    </span>
  );
}

function PitchFooterCard({ pitch }: { pitch: MlbPitch }) {
  return (
    <li className="min-w-0 space-y-0.5 px-2 py-1.5 text-[18px] even:border-l even:border-white/10">
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

export function MlbPitchZone({ situation }: { situation: MlbSituation }) {
  const pitches = situation.pitches;

  return (
    <GameSection className="!p-2.5" data-testid="mlb-pitch-zone">
      <div className="flex justify-center">
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
            width={STRIKE_SIZE}
            height={STRIKE_SIZE}
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.5"
          />
          <line
            x1={STRIKE_LEFT + STRIKE_SIZE / 3}
            y1={STRIKE_TOP}
            x2={STRIKE_LEFT + STRIKE_SIZE / 3}
            y2={STRIKE_TOP + STRIKE_SIZE}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.75"
          />
          <line
            x1={STRIKE_LEFT + (2 * STRIKE_SIZE) / 3}
            y1={STRIKE_TOP}
            x2={STRIKE_LEFT + (2 * STRIKE_SIZE) / 3}
            y2={STRIKE_TOP + STRIKE_SIZE}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.75"
          />
          <line
            x1={STRIKE_LEFT}
            y1={STRIKE_TOP + STRIKE_SIZE / 3}
            x2={STRIKE_LEFT + STRIKE_SIZE}
            y2={STRIKE_TOP + STRIKE_SIZE / 3}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.75"
          />
          <line
            x1={STRIKE_LEFT}
            y1={STRIKE_TOP + (2 * STRIKE_SIZE) / 3}
            x2={STRIKE_LEFT + STRIKE_SIZE}
            y2={STRIKE_TOP + (2 * STRIKE_SIZE) / 3}
            stroke="rgba(255,255,255,0.18)"
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
          <li className="col-span-2 py-1.5 text-center text-[18px] text-white/40">
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
