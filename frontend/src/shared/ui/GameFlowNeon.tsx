import { neonGlowColor } from "@/shared/lib/neonGlowColor";

export { neonGlowColor };

export function shouldNeonGameFlow(status: string): boolean {
  return status === "live" || status === "halftime" || status === "final";
}

export function GameFlowNeonFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-80%" y="-80%" width="260%" height="260%">
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
  );
}

export function NeonHaloPath({
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

export function NeonFilamentPath({ d }: { d: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="rgba(255,255,255,0.55)"
      strokeWidth={0.8}
      strokeLinejoin="round"
      strokeLinecap="round"
      pointerEvents="none"
    />
  );
}

export function neonMarkerStyle(stroke: string): { filter: string } {
  return { filter: `drop-shadow(0 0 7px ${stroke})` };
}
