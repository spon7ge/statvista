import type { ApiMlbStandingsDivision } from "@/shared/lib/api";
import { TeamAbbrevAvatar } from "@/shared/ui/TeamAbbrevAvatar";
import { mlbTeamLogoUrl } from "./mlbTeamLogos";

type MlbStandingsDivisionCardProps = {
  division: ApiMlbStandingsDivision;
};

function streakClass(streak: string): string {
  if (streak.startsWith("W")) return "text-white/80";
  if (streak.startsWith("L")) return "text-white/45";
  return "text-white/40";
}

export function MlbStandingsDivisionCard({
  division,
}: MlbStandingsDivisionCardProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-[18px] font-semibold tracking-tight text-white">
        {division.label}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-[18px]">
          <thead>
            <tr className="whitespace-nowrap text-[14px] tracking-wide text-white/35 uppercase">
              <th className="pb-2 pr-1.5 font-medium">#</th>
              <th className="pb-2 pr-1 font-medium">Team</th>
              <th className="pb-2 pr-1.5 font-medium">W-L</th>
              <th className="pb-2 pr-1.5 font-medium">PCT</th>
              <th className="pb-2 pr-1.5 font-medium">GB</th>
              <th className="pb-2 pr-1.5 font-medium">L10</th>
              <th className="pb-2 font-medium">Strk</th>
            </tr>
          </thead>
          <tbody>
            {division.teams.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-3 text-white/40">
                  No data
                </td>
              </tr>
            ) : (
              division.teams.map((row) => {
                const logoUrl = row.logo_url ?? mlbTeamLogoUrl(row.abbrev);
                return (
                  <tr
                    key={`${division.key}-${row.team_id}`}
                    className="whitespace-nowrap"
                  >
                    <td className="py-1 pr-1.5 text-white/50">{row.rank}</td>
                    <td className="py-1 pr-1">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <TeamAbbrevAvatar
                          abbrev={row.abbrev}
                          logoUrl={logoUrl}
                          sizeClassName="size-5"
                        />
                        <span className="shrink-0 font-semibold text-white">
                          {row.abbrev}
                        </span>
                      </div>
                    </td>
                    <td className="py-1 pr-1.5 tabular-nums text-white">
                      {row.wl}
                    </td>
                    <td className="py-1 pr-1.5 tabular-nums text-white/70">
                      {row.pct}
                    </td>
                    <td className="py-1 pr-1.5 tabular-nums text-white/70">
                      {row.gb}
                    </td>
                    <td className="py-1 pr-1.5 tabular-nums text-white/70">
                      {row.l10}
                    </td>
                    <td
                      className={`py-1 font-medium tabular-nums ${streakClass(row.streak)}`}
                    >
                      {row.streak}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
