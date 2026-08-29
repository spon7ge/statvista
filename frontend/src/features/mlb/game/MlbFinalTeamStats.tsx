import type { MlbGameDetailView, MlbTeamStatLine } from "../lib/types";
import {
  MlbTeamStatsComparison,
  type MlbTeamStatsComparisonRow,
} from "./MlbTeamStatsComparison";

type StatKey = keyof MlbTeamStatLine;

type StatDefinition = {
  key: StatKey;
  label: string;
  lowerIsBetter?: boolean;
};

const STAT_DEFINITIONS: StatDefinition[] = [
  { key: "hr", label: "HR" },
  { key: "r", label: "R" },
  { key: "h", label: "H" },
  { key: "sb", label: "SB" },
  { key: "lob", label: "LOB" },
  { key: "avg", label: "AVG" },
  { key: "obp", label: "OBP" },
  { key: "slg", label: "SLG" },
  { key: "era", label: "ERA", lowerIsBetter: true },
  { key: "k", label: "K" },
  { key: "bb", label: "BB", lowerIsBetter: true },
];

export function MlbFinalTeamStats({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  const teamStats = detail.teamStats;
  if (!teamStats) return null;

  const rows: MlbTeamStatsComparisonRow[] = STAT_DEFINITIONS.map((stat) => ({
    key: stat.key,
    label: stat.label,
    awayValue: teamStats.away[stat.key],
    homeValue: teamStats.home[stat.key],
    lowerIsBetter: stat.lowerIsBetter,
  }));

  return (
    <MlbTeamStatsComparison
      testId="mlb-final-team-stats"
      leaderTestIdPrefix="mlb-team-stat"
      away={detail.away}
      home={detail.home}
      rows={rows}
    />
  );
}
