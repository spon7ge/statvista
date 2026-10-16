import type { ApiNbaTeamPreviewResponse } from "@/shared/lib/api";
import { GameSection } from "@/shared/ui/GameSection";
import { resolveNbaTeamColor } from "../league/nbaTeamColors";

const ROSTER_COLUMNS = [
  ["position", "POS"],
  ["gp", "GP"],
  ["min", "MIN"],
  ["pts", "PTS"],
  ["reb", "REB"],
  ["ast", "AST"],
  ["stl", "STL"],
  ["blk", "BLK"],
  ["to", "TO"],
  ["fg_pct", "FG%"],
  ["fg3_pct", "3P%"],
  ["ft_pct", "FT%"],
  ["sh_eff", "SH-EFF"],
  ["sc_eff", "SC-EFF"],
  ["ppep", "PPEP"],
  ["rtg", "RTG"],
  ["plus_minus", "+/-"],
] as const;

export function NbaTeamPreview({
  data,
  isPending,
  error,
}: {
  data: ApiNbaTeamPreviewResponse | null;
  isPending: boolean;
  error: string | null;
}) {
  if (isPending || error || !data) {
    return (
      <div data-testid="nba-team-preview" className="text-[14px] text-c3">
        {isPending
          ? "Loading…"
          : error ?? "No season stats available"}
      </div>
    );
  }

  const accent = resolveNbaTeamColor(
    data.team.abbrev,
    "rgba(255,255,255,0.5)",
  );
  return (
    <div data-testid="nba-team-preview" className="flex flex-col gap-3">
      {data.leaders.length ? (
        <GameSection className="w-full !p-3">
          <h2 className="text-center font-semibold text-c3">Team Leaders</h2>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {data.leaders.map((leader) => (
              <div
                key={leader.key}
                data-testid={`nba-team-leader-card-${leader.key}`}
                className="flex flex-col items-center rounded p-2 text-center"
                style={{ backgroundColor: accent }}
              >
                <span className="text-[14px] font-semibold text-c3">
                  {leader.label}
                </span>
                <span className="text-[20px] font-semibold text-c3">
                  {leader.value}
                </span>
                {leader.rank != null ? (
                  <span className="text-[14px] text-c3">#{leader.rank}</span>
                ) : null}
                <span className="text-[14px] font-semibold uppercase text-c3">
                  {leader.last_name}
                </span>
              </div>
            ))}
          </div>
        </GameSection>
      ) : null}
      <GameSection className="w-full !p-3">
        <h2 className="font-semibold text-c3">Roster</h2>
        <div
          data-testid="nba-team-roster-table"
          className="mt-2 overflow-x-auto"
        >
          {data.roster.length === 0 ? (
            <p className="text-[14px] text-c3">No season stats available</p>
          ) : (
            <table className="min-w-max text-[14px] text-c3">
              <thead>
                <tr>
                  <th className="pr-4 text-left">PLAYER</th>
                  {ROSTER_COLUMNS.map(([, label]) => (
                    <th key={label} className="px-2 text-right">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.roster.map((row) => (
                  <tr key={row.player_id} className="border-t border-line">
                    <td className="py-1.5 pr-4">{row.name}</td>
                    {ROSTER_COLUMNS.map(([key, label]) => (
                      <td
                        key={`${row.player_id}-${label}`}
                        className="px-2 text-right tabular-nums"
                      >
                        {row[key] ?? "–"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </GameSection>
    </div>
  );
}
