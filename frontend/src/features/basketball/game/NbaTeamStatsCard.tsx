import { GameSection } from "@/shared/ui/GameSection";
import type { GameDetail } from "../lib/types";

export function NbaTeamStatsCard({ detail }: { detail: GameDetail }) {
  const stats = detail.winProbability?.teamStats;
  if (!stats?.length) return null;
  return (
    <GameSection data-testid="nba-team-stats-card" className="!p-3">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] gap-3">
        <span className="font-semibold text-c3">{detail.away.abbrev}</span>
        <h2 className="font-semibold text-c3">Team Stats</h2>
        <span className="text-right font-semibold text-c3">
          {detail.home.abbrev}
        </span>
      </div>
      {stats.map((stat) => (
        <div
          key={stat.key}
          className="grid grid-cols-[1fr_auto_1fr] gap-3 border-b border-line py-2 last:border-b-0"
        >
          <span className="tabular-nums text-c3">{stat.awayValue}</span>
          <span className="text-center text-c3">{stat.label}</span>
          <span className="text-right tabular-nums text-c3">
            {stat.homeValue}
          </span>
        </div>
      ))}
    </GameSection>
  );
}
