import { useState } from "react";
import { Link } from "react-router-dom";
import type { ApiWnbaLeaderCategory } from "@/shared/lib/api";
import { wnbaTeamLogoUrl } from "./wnbaTeamLogos";

type LeaderCategoryCardProps = {
  category: ApiWnbaLeaderCategory;
};

function TeamCell({ abbrev }: { abbrev: string }) {
  const logoUrl = wnbaTeamLogoUrl(abbrev);
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !logoFailed;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-semibold text-white">{abbrev}</span>
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

export function LeaderCategoryCard({ category }: LeaderCategoryCardProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-base font-semibold tracking-tight text-white">
        {category.label}
      </h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[11px] tracking-wide text-white/35 uppercase">
            <th className="pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">Player</th>
            <th className="pb-2 font-medium">Team</th>
            <th className="pb-2 text-right font-medium">GP</th>
            <th className="pb-2 text-right font-medium">{category.stat}</th>
          </tr>
        </thead>
        <tbody>
          {category.leaders.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-3 text-white/40">
                No data
              </td>
            </tr>
          ) : (
            category.leaders.map((row) => (
              <tr key={`${category.key}-${row.rank}-${row.player_id}`}>
                <td className="py-1.5 text-white/40">{row.rank}</td>
                <td className="py-1.5 text-white">
                  <Link
                    to={`/wnba/player/${row.player_id}`}
                    className="text-white hover:underline focus-visible:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="py-1.5">
                  <TeamCell abbrev={row.team_abbrev} />
                </td>
                <td className="py-1.5 text-right text-white/45">{row.gp}</td>
                <td className="py-1.5 text-right font-semibold text-white">
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
