import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import { deriveQuarterLinescore } from "../lib/quarterLinescore";
import type { GameDetail, GameDetailTeam } from "../lib/types";

function TeamMark({ team }: { team: GameDetailTeam }) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <span className="inline-flex items-center gap-1.5">
      {team.logoUrl && !logoFailed ? (
        <img
          src={team.logoUrl}
          alt=""
          role="presentation"
          className="size-4 shrink-0 object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : null}
      <span className="font-sans text-[16px] font-semibold tracking-wide text-c3">
        {team.abbrev}
      </span>
    </span>
  );
}

function cellValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return String(value);
}

export function WnbaQuarterScoreCard({ detail }: { detail: GameDetail }) {
  const linescore = deriveQuarterLinescore(
    detail.plays,
    detail.away.score,
    detail.home.score,
  );

  const periods = linescore?.periods ?? [];
  const awayTotal = linescore?.awayTotal ?? detail.away.score;
  const homeTotal = linescore?.homeTotal ?? detail.home.score;

  return (
    <GameSection className="!p-3" data-testid="wnba-quarter-score-card">
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[12rem] border-collapse text-center text-[16px]"
          data-testid="wnba-quarter-score-table"
        >
          <thead>
            <tr className="text-c3">
              <th className="w-14 px-1 pb-2 text-left font-medium" scope="col" />
              {periods.map((period) => (
                <th
                  key={period.period}
                  scope="col"
                  className="px-1 pb-2 font-medium"
                >
                  {period.period}
                </th>
              ))}
              <th className="px-1.5 pb-2 font-semibold text-c3" scope="col">
                T
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-c3">
            {(
              [
                ["away", detail.away, periods.map((p) => p.away), awayTotal],
                ["home", detail.home, periods.map((p) => p.home), homeTotal],
              ] as const
            ).map(([side, team, periodScores, total]) => (
              <tr key={side}>
                <th scope="row" className="px-1 py-1.5 text-left font-normal">
                  <TeamMark team={team} />
                </th>
                {periodScores.map((score, index) => (
                  <td key={`${side}-${periods[index]?.period ?? index}`} className="px-1 py-1.5">
                    {cellValue(score)}
                  </td>
                ))}
                <td className="px-1.5 py-1.5 font-semibold text-c3">
                  {cellValue(total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GameSection>
  );
}
