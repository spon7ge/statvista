import { GameSection } from "@/components/game/GameSection";
import type { MlbGameDetailView, MlbLinescoreInning } from "./types";

function cellValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function padInnings(innings: MlbLinescoreInning[]): MlbLinescoreInning[] {
  const byNum = new Map(innings.map((inning) => [inning.num, inning]));
  const maxNum = Math.max(9, ...innings.map((inning) => inning.num), 0);
  const padded: MlbLinescoreInning[] = [];
  for (let num = 1; num <= maxNum; num += 1) {
    padded.push(byNum.get(num) ?? { num, awayRuns: null, homeRuns: null });
  }
  return padded;
}

export function MlbLinescore({ detail }: { detail: MlbGameDetailView }) {
  const linescore = detail.linescore;
  if (!linescore) return null;

  const innings = padInnings(linescore.innings);
  const current = linescore.currentInning;

  return (
    <GameSection className="!p-3 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-center text-xs">
        <thead>
          <tr className="text-white/40">
            <th className="px-1 pb-2 text-left font-medium" scope="col">
              {" "}
            </th>
            {innings.map((inning) => (
              <th
                key={inning.num}
                scope="col"
                className={`px-1 pb-2 font-medium ${
                  current === inning.num ? "text-red-400" : ""
                }`}
              >
                {inning.num}
              </th>
            ))}
            <th className="px-1.5 pb-2 font-semibold text-white/55" scope="col">
              R
            </th>
            <th className="px-1.5 pb-2 font-semibold text-white/55" scope="col">
              H
            </th>
            <th className="px-1.5 pb-2 font-semibold text-white/55" scope="col">
              E
            </th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums text-white/85">
          {(
            [
              ["away", detail.away.abbrev, linescore.away] as const,
              ["home", detail.home.abbrev, linescore.home] as const,
            ] as const
          ).map(([side, abbrev, totals]) => (
            <tr key={side}>
              <th
                scope="row"
                className="px-1 py-1 text-left font-sans text-[11px] font-semibold"
                style={{
                  color: side === "away" ? detail.away.color : detail.home.color,
                }}
              >
                {abbrev}
              </th>
              {innings.map((inning) => {
                const runs =
                  side === "away" ? inning.awayRuns : inning.homeRuns;
                const isCurrent = current === inning.num;
                return (
                  <td
                    key={`${side}-${inning.num}`}
                    className={`px-1 py-1 ${
                      isCurrent ? "bg-red-500/10 text-white" : ""
                    }`}
                  >
                    {cellValue(runs)}
                  </td>
                );
              })}
              <td className="px-1.5 py-1 font-semibold text-white">
                {totals.runs}
              </td>
              <td className="px-1.5 py-1">{totals.hits}</td>
              <td className="px-1.5 py-1">{totals.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </GameSection>
  );
}
