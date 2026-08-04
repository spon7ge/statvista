import { useState } from "react";
import { GameSection } from "@/components/game/GameSection";
import type {
  MlbGameDetailTeam,
  MlbGameDetailView,
  MlbLinescoreInning,
} from "./types";

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

function TeamMark({ team }: { team: MlbGameDetailTeam }) {
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
      <span className="font-sans text-[11px] font-semibold tracking-wide text-white">
        {team.abbrev}
      </span>
    </span>
  );
}

export function MlbLinescore({
  detail,
  embedded = false,
}: {
  detail: MlbGameDetailView;
  /** Skip outer GameSection when nested in another card. */
  embedded?: boolean;
}) {
  const linescore = detail.linescore;
  if (!linescore) return null;

  const innings = padInnings(linescore.innings);
  const current = linescore.currentInning;
  const isFinal = detail.status === "final";

  const table = (
    <div className="overflow-x-auto">
      <table
        className="w-full min-w-[28rem] border-collapse text-center text-xs"
        data-testid="mlb-linescore-table"
      >
        <thead>
          <tr className="text-white/40">
            <th className="w-14 px-1 pb-2 text-left font-medium" scope="col" />
            {innings.map((inning) => (
              <th
                key={inning.num}
                scope="col"
                className={`px-1 pb-2 font-medium ${
                  !isFinal && current === inning.num ? "text-red-400" : ""
                }`}
              >
                {inning.num}
              </th>
            ))}
            <th className="px-1.5 pb-2 font-semibold text-white" scope="col">
              R
            </th>
            <th className="px-1.5 pb-2 font-medium text-white/45" scope="col">
              H
            </th>
            <th className="px-1.5 pb-2 font-medium text-white/45" scope="col">
              E
            </th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums text-white/70">
          {(
            [
              ["away", detail.away, linescore.away] as const,
              ["home", detail.home, linescore.home] as const,
            ] as const
          ).map(([side, team, totals]) => (
            <tr key={side}>
              <th scope="row" className="px-1 py-1.5 text-left font-normal">
                <TeamMark team={team} />
              </th>
              {innings.map((inning) => {
                const runs =
                  side === "away" ? inning.awayRuns : inning.homeRuns;
                const isCurrent = !isFinal && current === inning.num;
                // Final: unplayed home half (e.g. bottom 9th) shows X
                const display =
                  runs == null && isFinal && side === "home" && inning.num >= 9
                    ? "X"
                    : cellValue(runs);
                return (
                  <td
                    key={`${side}-${inning.num}`}
                    className={`px-1 py-1.5 ${
                      isCurrent ? "bg-red-500/10 text-white" : ""
                    }`}
                  >
                    {display}
                  </td>
                );
              })}
              <td className="px-1.5 py-1.5 font-semibold text-white">
                {totals.runs}
              </td>
              <td className="px-1.5 py-1.5">{totals.hits}</td>
              <td className="px-1.5 py-1.5">{totals.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (embedded) return table;

  return (
    <GameSection className="!p-3" data-testid="mlb-linescore">
      {table}
    </GameSection>
  );
}
