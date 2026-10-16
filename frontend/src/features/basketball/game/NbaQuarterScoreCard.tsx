import { GameSection } from "@/shared/ui/GameSection";
import { deriveQuarterLinescore } from "../lib/quarterLinescore";
import type { GameDetail } from "../lib/types";

export function NbaQuarterScoreCard({ detail }: { detail: GameDetail }) {
  const linescore = deriveQuarterLinescore(
    detail.plays,
    detail.away.score,
    detail.home.score,
  );
  const periods = linescore?.periods ?? [];
  return (
    <GameSection className="!p-3" data-testid="nba-quarter-score-card">
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[12rem] border-collapse text-center text-[16px]"
          data-testid="nba-quarter-score-table"
        >
          <thead>
            <tr className="text-c3">
              <th scope="col" />
              {periods.map((period) => (
                <th key={period.period} scope="col">
                  {period.period}
                </th>
              ))}
              <th scope="col">T</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-c3">
            {(["away", "home"] as const).map((side) => {
              const team = detail[side];
              const scores = periods.map((period) => period[side]);
              const total =
                side === "away"
                  ? linescore?.awayTotal
                  : linescore?.homeTotal;
              return (
                <tr key={side}>
                  <th scope="row" className="text-left">
                    {team.abbrev}
                  </th>
                  {scores.map((score, index) => (
                    <td key={`${side}-${periods[index]?.period}`}>
                      {score ?? "–"}
                    </td>
                  ))}
                  <td className="font-semibold">{total ?? team.score ?? "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GameSection>
  );
}
