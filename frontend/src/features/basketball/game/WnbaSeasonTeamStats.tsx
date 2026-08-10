import { GameSection } from "@/shared/ui/GameSection";
import type {
  GameDetail,
  GameDetailSeasonTeamStatLine,
  GameDetailTeam,
} from "../lib/types";

type TeamSide = "away" | "home";
type StatValueKey =
  | "pts"
  | "fgPct"
  | "fg3Pct"
  | "ftPct"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "to";

type StatDefinition = {
  key: StatValueKey;
  label: string;
  lowerIsBetter?: boolean;
};

const RANK_KEY: Record<StatValueKey, keyof GameDetailSeasonTeamStatLine> = {
  pts: "ptsRank",
  fgPct: "fgPctRank",
  fg3Pct: "fg3PctRank",
  ftPct: "ftPctRank",
  reb: "rebRank",
  ast: "astRank",
  stl: "stlRank",
  blk: "blkRank",
  to: "toRank",
};

const STAT_DEFINITIONS: StatDefinition[] = [
  { key: "pts", label: "PTS" },
  { key: "fgPct", label: "FG%" },
  { key: "fg3Pct", label: "3P%" },
  { key: "ftPct", label: "FT%" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "to", label: "TO", lowerIsBetter: true },
];

function numericValue(value: string | number | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function leader(
  away: string | number | null,
  home: string | number | null,
  lowerIsBetter: boolean,
): TeamSide | null {
  const awayValue = numericValue(away);
  const homeValue = numericValue(home);
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
  team: GameDetailTeam;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-1.5 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      <span className="text-[18px] font-semibold text-white">
        {team.abbrev}
      </span>
      {team.logoUrl ? (
        <img
          src={team.logoUrl}
          alt=""
          role="presentation"
          className="size-5 object-contain"
        />
      ) : null}
    </div>
  );
}

function formatStatDisplay(value: string | number | null): string {
  if (value === null || value === "") return "–";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "–";
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return value;
}

function StatValue({
  side,
  statKey,
  value,
  rank,
  isLeader,
  color,
}: {
  side: TeamSide;
  statKey: StatValueKey;
  value: string | number | null;
  rank: number | null;
  isLeader: boolean;
  color: string;
}) {
  const display = formatStatDisplay(value);

  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-[18px] tabular-nums text-white ${
        side === "home" ? "justify-end" : ""
      }`}
    >
      {isLeader ? (
        <span
          aria-label={`${statKey} ${side} leader`}
          data-testid={`wnba-season-stat-${statKey}-${side}`}
          className="rounded-full px-2.5 py-0.5 text-white"
          style={{ backgroundColor: color }}
        >
          {display}
        </span>
      ) : (
        <span>{display}</span>
      )}
      {rank != null ? (
        <span
          data-testid={`wnba-season-stat-${statKey}-rank-${side}`}
          className="text-[14px] text-white/40"
        >
          {`#${rank}`}
        </span>
      ) : null}
    </div>
  );
}

export function WnbaSeasonTeamStats({ detail }: { detail: GameDetail }) {
  const seasonTeamStats = detail.seasonTeamStats;
  if (!seasonTeamStats) return null;

  return (
    <GameSection
      data-testid="wnba-season-team-stats"
      className="w-full !p-3"
    >
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3">
        <TeamMark team={detail.away} align="left" />
        <h2 className="text-[18px] font-semibold text-white">Team Stats</h2>
        <TeamMark team={detail.home} align="right" />
      </div>
      <div>
        {STAT_DEFINITIONS.map((stat) => {
          const awayValue = seasonTeamStats.away[stat.key];
          const homeValue = seasonTeamStats.home[stat.key];
          const winningSide = leader(
            awayValue,
            homeValue,
            Boolean(stat.lowerIsBetter),
          );

          return (
            <div
              key={stat.key}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 border-b border-white/[0.06] py-2 last:border-b-0"
            >
              <StatValue
                side="away"
                statKey={stat.key}
                value={awayValue}
                rank={
                  seasonTeamStats.away[RANK_KEY[stat.key]] as number | null
                }
                isLeader={winningSide === "away"}
                color={detail.away.color}
              />
              <span className="min-w-[2.5rem] text-center text-[18px] font-medium tracking-wide text-white/45">
                {stat.label}
              </span>
              <StatValue
                side="home"
                statKey={stat.key}
                value={homeValue}
                rank={
                  seasonTeamStats.home[RANK_KEY[stat.key]] as number | null
                }
                isLeader={winningSide === "home"}
                color={detail.home.color}
              />
            </div>
          );
        })}
      </div>
    </GameSection>
  );
}
