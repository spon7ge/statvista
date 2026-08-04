import type { MlbSituation } from "./types";

type Runners = MlbSituation["runners"];

export function MlbBaseDiamond({
  runners,
  occupiedFill = "rgba(248, 113, 113, 0.9)",
  occupiedStroke = "rgb(248, 113, 113)",
}: {
  runners: Runners;
  occupiedFill?: string;
  occupiedStroke?: string;
}) {
  const bases = [
    { key: "second", occupied: runners.second, x: 34, y: 8 },
    { key: "third", occupied: runners.third, x: 12, y: 30 },
    { key: "first", occupied: runners.first, x: 56, y: 30 },
  ] as const;

  return (
    <svg
      viewBox="0 0 80 56"
      className="h-14 w-[4.5rem] shrink-0"
      role="img"
      aria-label={`Runners: first ${runners.first ? "on" : "empty"}, second ${
        runners.second ? "on" : "empty"
      }, third ${runners.third ? "on" : "empty"}`}
    >
      {bases.map((base) => (
        <rect
          key={base.key}
          x={base.x}
          y={base.y}
          width={11}
          height={11}
          rx={1}
          transform={`rotate(45 ${base.x + 5.5} ${base.y + 5.5})`}
          fill={base.occupied ? occupiedFill : "transparent"}
          stroke={
            base.occupied ? occupiedStroke : "rgba(255,255,255,0.35)"
          }
          strokeWidth="1.25"
        />
      ))}
    </svg>
  );
}
