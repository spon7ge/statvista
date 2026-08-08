import { useState } from "react";
import type { ApiMlbLeaderCategory } from "@/shared/lib/api";
import { mlbTeamLogoUrl } from "./mlbTeamLogos";

type MlbLeaderCategoryCardProps = {
  category: ApiMlbLeaderCategory;
};

function TeamCell({ abbrev }: { abbrev: string }) {
  const logoUrl = mlbTeamLogoUrl(abbrev);
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !logoFailed;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[18px] font-semibold text-white">{abbrev}</span>
      {showLogo && logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          role="presentation"
          className="size-5 shrink-0 object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : null}
    </span>
  );
}

export function MlbLeaderCategoryCard({
  category,
}: MlbLeaderCategoryCardProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-[18px] font-semibold tracking-tight text-white">
        {category.label}
      </h3>
      <table className="w-full text-left text-[18px]">
        <thead>
          <tr className="text-[14px] tracking-wide text-white/35 uppercase">
            <th className="pb-2 text-[14px] font-medium">#</th>
            <th className="pb-2 text-[14px] font-medium">Player</th>
            <th className="pb-2 text-[14px] font-medium">Team</th>
            <th className="pb-2 text-right text-[14px] font-medium">
              {category.stat}
            </th>
          </tr>
        </thead>
        <tbody>
          {category.leaders.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-3 text-white/40">
                No data
              </td>
            </tr>
          ) : (
            category.leaders.map((row) => (
              <tr key={`${category.key}-${row.rank}-${row.player_id}`}>
                <td className="py-1.5 text-[18px] text-white/40">{row.rank}</td>
                <td className="py-1.5 text-[18px] text-white">{row.name}</td>
                <td className="py-1.5">
                  <TeamCell abbrev={row.team_abbrev} />
                </td>
                <td className="py-1.5 text-right text-[18px] font-semibold text-white">
                  {row.value}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
