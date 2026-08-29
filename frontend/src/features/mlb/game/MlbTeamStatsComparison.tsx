import { GameSection } from "@/shared/ui/GameSection";
import type { MlbGameDetailTeam } from "../lib/types";

type TeamSide = "away" | "home";

export type MlbTeamStatsComparisonRow = {
  key: string;
  label: string;
  awayValue: string | number | null;
  homeValue: string | number | null;
  lowerIsBetter?: boolean;
  awayRank?: number | null;
  homeRank?: number | null;
};

function numericStatValue(value: string | number | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statLeader(
  away: string | number | null,
  home: string | number | null,
  lowerIsBetter: boolean,
): TeamSide | null {
  const awayValue = numericStatValue(away);
  const homeValue = numericStatValue(home);
  if (awayValue === null || homeValue === null || awayValue === homeValue) {
    return null;
  }

  const awayWins = lowerIsBetter
    ? awayValue < homeValue
    : awayValue > homeValue;
  return awayWins ? "away" : "home";
}

function TeamMark({
  team,
  align,
}: {
  team: MlbGameDetailTeam;
  align: "left" | "right";
}) {
  const logo = team.logoUrl ? (
    <img
      src={team.logoUrl}
      alt=""
      role="presentation"
      className="size-[18px] object-contain"
    />
  ) : null;
  const abbrev = <span className="text-white">{team.abbrev}</span>;

  return (
    <div
      data-testid={
        align === "left"
          ? "mlb-team-stats-away-mark"
          : "mlb-team-stats-home-mark"
      }
      className={`absolute top-[9px] flex items-center gap-[9px] ${
        align === "left" ? "left-[13px]" : "right-[13px]"
      }`}
    >
      {align === "left" ? (
        <>
          {logo}
          {abbrev}
        </>
      ) : (
        <>
          {abbrev}
          {logo}
        </>
      )}
    </div>
  );
}

function Rank({
  rank,
  statKey,
  side,
  testIdPrefix,
}: {
  rank: number | null | undefined;
  statKey: string;
  side: TeamSide;
  testIdPrefix: string;
}) {
  if (rank == null) return null;
  return (
    <span
      data-testid={`${testIdPrefix}-${statKey}-rank-${side}`}
      className="text-[14px] text-white/40"
    >
      {`#${rank}`}
    </span>
  );
}

function StatChip({
  side,
  statKey,
  value,
  rank,
  isLeader,
  color,
  testIdPrefix,
}: {
  side: TeamSide;
  statKey: string;
  value: string | number | null;
  rank?: number | null;
  isLeader: boolean;
  color: string;
  testIdPrefix: string;
}) {
  const display = value ?? "–";
  const pill = (
    <span
      aria-label={isLeader ? `${statKey} ${side} leader` : undefined}
      data-testid={
        isLeader ? `${testIdPrefix}-${statKey}-${side}` : undefined
      }
      className="rounded-2xl px-[9px] text-white"
      style={
        isLeader ? { backgroundColor: color, color: "#FFFFFF" } : undefined
      }
    >
      {display}
    </span>
  );

  return (
    <div
      className={`absolute top-1 flex items-center gap-1 ${
        side === "away" ? "left-1" : "right-1"
      }`}
    >
      {side === "away" ? (
        <>
          {pill}
          <Rank
            rank={rank}
            statKey={statKey}
            side={side}
            testIdPrefix={testIdPrefix}
          />
        </>
      ) : (
        <>
          <Rank
            rank={rank}
            statKey={statKey}
            side={side}
            testIdPrefix={testIdPrefix}
          />
          {pill}
        </>
      )}
    </div>
  );
}

export function MlbTeamStatsComparison({
  testId,
  leaderTestIdPrefix,
  away,
  home,
  rows,
}: {
  testId: string;
  leaderTestIdPrefix: string;
  away: MlbGameDetailTeam;
  home: MlbGameDetailTeam;
  rows: MlbTeamStatsComparisonRow[];
}) {
  return (
    <GameSection data-testid={testId} className="w-full !p-0">
      <div className="relative flex justify-center py-[9px]">
        <TeamMark team={away} align="left" />
        <h2 className="whitespace-pre font-semibold text-white">Team Stats</h2>
        <TeamMark team={home} align="right" />
      </div>
      <div className="divide-y divide-white/10 border-t border-white/10">
        {rows.map((stat) => {
          const winningSide = statLeader(
            stat.awayValue,
            stat.homeValue,
            Boolean(stat.lowerIsBetter),
          );

          return (
            <div
              key={stat.key}
              className="relative flex justify-center px-1 py-1"
            >
              <StatChip
                side="away"
                statKey={stat.key}
                value={stat.awayValue}
                rank={stat.awayRank}
                isLeader={winningSide === "away"}
                color={away.color}
                testIdPrefix={leaderTestIdPrefix}
              />
              <p className="text-white/45">{stat.label}</p>
              <StatChip
                side="home"
                statKey={stat.key}
                value={stat.homeValue}
                rank={stat.homeRank}
                isLeader={winningSide === "home"}
                color={home.color}
                testIdPrefix={leaderTestIdPrefix}
              />
            </div>
          );
        })}
      </div>
    </GameSection>
  );
}
