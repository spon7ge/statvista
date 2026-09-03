import strikeZoneUrl from "@/assets/strike-zone.svg";
import { GameSection } from "@/shared/ui/GameSection";
import type { MlbPitch, MlbSituation } from "../lib/types";

// strike-zone.svg inner 3×3 grid (viewBox 0 0 982 412.9).
// Cells start at (430.2, 118.3), each 40.5 × 48.5.
export const ZONE_CENTER_X = 430.2 + (40.5 * 3) / 2;
export const ZONE_CENTER_Y = 118.3 + (48.5 * 3) / 2;
export const ZONE_SCALE_X = (40.5 * 3) / 2;
export const ZONE_SCALE_Y = (48.5 * 3) / 2;
const MARKER_R = 14;
/** Just outside the unit square so ball markers clear the stroke. */
const BALL_OUTSIDE = 1.08;
export const MLB_BALL_FILL = "rgba(74, 222, 128, 0.9)";
export const MLB_STRIKE_FILL = "rgba(248, 113, 113, 0.9)";

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
    cx: ZONE_CENTER_X + x * ZONE_SCALE_X,
    cy: ZONE_CENTER_Y - y * ZONE_SCALE_Y,
  };
}

function pitchFill(isStrike: boolean): string {
  return isStrike ? MLB_STRIKE_FILL : MLB_BALL_FILL;
}

function SpinLine({ pitch }: { pitch: MlbPitch }) {
  if (pitch.spinRate == null && pitch.spinDirection == null) return null;
  const parts: string[] = [];
  if (pitch.spinRate != null) parts.push(`${Math.round(pitch.spinRate)} rpm`);
  if (pitch.spinDirection != null)
    parts.push(`${Math.round(pitch.spinDirection)} deg`);
  return <p className="text-[16px] text-c3">Spin: {parts.join(", ")}</p>;
}

function PitchNumberDot({ pitch }: { pitch: MlbPitch }) {
  return (
    <span
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-black"
      style={{
        backgroundColor: pitch.isStrike ? MLB_STRIKE_FILL : MLB_BALL_FILL,
      }}
    >
      {pitch.number}
    </span>
  );
}

function PitchFooterCard({ pitch }: { pitch: MlbPitch }) {
  return (
    <li className="min-w-0 space-y-0.5 px-2 py-1.5 text-[16px] even:border-l even:border-line">
      <p className="flex items-center gap-1.5 font-semibold text-c3">
        <PitchNumberDot pitch={pitch} />
        <span className="truncate">{pitch.result ?? "Pitch"}</span>
      </p>
      <p className="text-c3">
        {pitch.mph !== null ? (
          <span className="tabular-nums">
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
          viewBox="0 0 982 412.9"
          className="w-full"
          role="img"
          aria-label="Pitch strike zone"
          data-testid="mlb-pitch-zone-svg"
        >
          <image
            href={strikeZoneUrl}
            width={982}
            height={412.9}
            data-testid="mlb-pitch-zone-batter-silhouette"
          />

          {pitches.map((pitch) => {
            const point = plotPitch(pitch);
            if (!point) return null;
            return (
              <g key={pitch.number}>
                <circle
                  cx={point.cx}
                  cy={point.cy}
                  r={MARKER_R}
                  fill={pitchFill(pitch.isStrike)}
                  data-testid="mlb-pitch-marker"
                />
                <text
                  x={point.cx}
                  y={point.cy + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#000"
                  fontSize={16}
                  fontWeight={700}
                >
                  {pitch.number}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="mt-2 grid grid-cols-2 border-t border-line pt-1.5">
        {pitches.length === 0 ? (
          <li className="col-span-2 py-1.5 text-center text-[16px] text-c3">
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
