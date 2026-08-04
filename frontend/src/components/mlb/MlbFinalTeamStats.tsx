import { GameSection } from "@/components/game/GameSection";
import type {
  MlbGameDetailTeam,
  MlbGameDetailView,
  MlbTeamStatLine,
} from "./types";

type TeamSide = "away" | "home";
type StatKey = keyof MlbTeamStatLine;

type StatDefinition = {
  key: StatKey;
  label: string;
  lowerIsBetter?: boolean;
};

const STAT_DEFINITIONS: StatDefinition[] = [
  { key: "avg", label: "AVG" },
  { key: "obp", label: "OBP" },
  { key: "slg", label: "SLG" },
  { key: "hr", label: "HR" },
  { key: "r", label: "R" },
  { key: "h", label: "H" },
  { key: "k", label: "K" },
  { key: "sb", label: "SB" },
  { key: "lob", label: "LOB" },
  { key: "era", label: "ERA", lowerIsBetter: true },
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

function TeamHeading({
  team,
  align,
}: {
  team: MlbGameDetailTeam;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {align === "left" && team.logoUrl ? (
        <img src={team.logoUrl} alt="" className="size-5 object-contain" />
      ) : null}
      <span className="text-xs font-semibold" style={{ color: team.color }}>
        {team.abbrev}
      </span>
      {align === "right" && team.logoUrl ? (
        <img src={team.logoUrl} alt="" className="size-5 object-contain" />
      ) : null}
    </div>
  );
}

function StatValue({
  side,
  statKey,
  value,
  isLeader,
  color,
}: {
  side: TeamSide;
  statKey: StatKey;
  value: string | number | null;
  isLeader: boolean;
  color: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-xs tabular-nums text-white/85 ${
        side === "home" ? "justify-end" : ""
      }`}
    >
      {side === "home" && isLeader ? (
        <span
          aria-label={`${statKey} home leader`}
          className="size-2 rounded-full"
          data-testid={`mlb-team-stat-${statKey}-home`}
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span>{value ?? "–"}</span>
      {side === "away" && isLeader ? (
        <span
          aria-label={`${statKey} away leader`}
          className="size-2 rounded-full"
          data-testid={`mlb-team-stat-${statKey}-away`}
          style={{ backgroundColor: color }}
        />
      ) : null}
    </div>
  );
}

export function MlbFinalTeamStats({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  const teamStats = detail.teamStats;
  if (!teamStats) return null;

  return (
    <GameSection
      data-testid="mlb-final-team-stats"
      className="!p-3"
    >
      <h2 className="mb-3 text-sm font-semibold text-white">Team stats</h2>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 border-b border-white/[0.08] pb-2">
        <TeamHeading team={detail.away} align="left" />
        <span className="text-[10px] font-medium tracking-wide text-white/35">
          STAT
        </span>
        <TeamHeading team={detail.home} align="right" />
      </div>
      <div>
        {STAT_DEFINITIONS.map((stat) => {
          const awayValue = teamStats.away[stat.key];
          const homeValue = teamStats.home[stat.key];
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
                isLeader={winningSide === "away"}
                color={detail.away.color}
              />
              <span className="text-[10px] font-medium tracking-wide text-white/45">
                {stat.label}
              </span>
              <StatValue
                side="home"
                statKey={stat.key}
                value={homeValue}
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
