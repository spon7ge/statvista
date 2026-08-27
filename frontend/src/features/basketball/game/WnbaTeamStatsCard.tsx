import { GameSection } from "@/shared/ui/GameSection";
import type {
  GameDetail,
  GameDetailTeam,
  GameDetailTeamStat,
} from "../lib/types";

type TeamSide = "away" | "home";

function leader(
  awayValue: number,
  homeValue: number,
): TeamSide | null {
  if (awayValue === homeValue) return null;
  return awayValue > homeValue ? "away" : "home";
}

function TeamMark({
  team,
  align,
}: {
  team: GameDetailTeam;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-1.5 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      <span className="text-[18px] font-semibold text-white">{team.abbrev}</span>
      {team.logoUrl ? (
        <img
          src={team.logoUrl}
          alt=""
          role="presentation"
          className="size-6 object-contain"
        />
      ) : null}
    </div>
  );
}

function StatValue({
  side,
  value,
  isLeader,
  color,
  label,
}: {
  side: TeamSide;
  value: number;
  isLeader: boolean;
  color: string;
  label: string;
}) {
  return (
    <div
      className={`flex items-center font-mono text-[18px] tabular-nums text-white/85 ${
        side === "home" ? "justify-end" : ""
      }`}
    >
      {isLeader ? (
        <span
          aria-label={`${label} ${side} leader`}
          className="rounded-full px-2.5 py-0.5 text-white"
          style={{ backgroundColor: color }}
        >
          {value}
        </span>
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}

function StatRow({
  stat,
  detail,
}: {
  stat: GameDetailTeamStat;
  detail: GameDetail;
}) {
  const winningSide = leader(stat.awayValue, stat.homeValue);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 border-b border-white/[0.06] py-2 last:border-b-0">
      <StatValue
        side="away"
        value={stat.awayValue}
        isLeader={winningSide === "away"}
        color={detail.away.color}
        label={stat.label}
      />
      <span className="min-w-[2.5rem] text-center text-[18px] font-medium tracking-wide text-white/45">
        {stat.label}
      </span>
      <StatValue
        side="home"
        value={stat.homeValue}
        isLeader={winningSide === "home"}
        color={detail.home.color}
        label={stat.label}
      />
    </div>
  );
}

export function WnbaTeamStatsCard({ detail }: { detail: GameDetail }) {
  const teamStats = detail.winProbability?.teamStats;
  if (!teamStats || teamStats.length === 0) return null;

  return (
    <GameSection data-testid="wnba-team-stats-card" className="!p-3">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3">
        <TeamMark team={detail.away} align="left" />
        <h2 className="font-semibold text-white">Team Stats</h2>
        <TeamMark team={detail.home} align="right" />
      </div>
      <div>
        {teamStats.map((stat) => (
          <StatRow key={stat.key} stat={stat} detail={detail} />
        ))}
      </div>
    </GameSection>
  );
}
