import type {
  MlbGameDetailView,
  MlbSeasonTeamStatLine,
} from "../lib/types";
import {
  MlbTeamStatsComparison,
  type MlbTeamStatsComparisonRow,
} from "./MlbTeamStatsComparison";

type StatValueKey =
  | "hr"
  | "r"
  | "h"
  | "avg"
  | "obp"
  | "slg"
  | "era"
  | "so"
  | "bb";

type StatDefinition = {
  key: StatValueKey;
  label: string;
  lowerIsBetter?: boolean;
};

const RANK_KEY: Record<StatValueKey, keyof MlbSeasonTeamStatLine> = {
  hr: "hrRank",
  r: "rRank",
  h: "hRank",
  avg: "avgRank",
  obp: "obpRank",
  slg: "slgRank",
  era: "eraRank",
  so: "soRank",
  bb: "bbRank",
};

const STAT_DEFINITIONS: StatDefinition[] = [
  { key: "hr", label: "HR" },
  { key: "r", label: "R" },
  { key: "h", label: "H" },
  { key: "avg", label: "AVG" },
  { key: "obp", label: "OBP" },
  { key: "slg", label: "SLG" },
  { key: "era", label: "ERA", lowerIsBetter: true },
  { key: "so", label: "K" },
  { key: "bb", label: "BB", lowerIsBetter: true },
];

export function MlbSeasonTeamStats({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  const seasonTeamStats = detail.seasonTeamStats;
  if (!seasonTeamStats) return null;

  const rows: MlbTeamStatsComparisonRow[] = STAT_DEFINITIONS.map((stat) => ({
    key: stat.key,
    label: stat.label,
    awayValue: seasonTeamStats.away[stat.key],
    homeValue: seasonTeamStats.home[stat.key],
    lowerIsBetter: stat.lowerIsBetter,
    awayRank: seasonTeamStats.away[RANK_KEY[stat.key]] as number | null,
    homeRank: seasonTeamStats.home[RANK_KEY[stat.key]] as number | null,
  }));

  return (
    <MlbTeamStatsComparison
      testId="mlb-season-team-stats"
      leaderTestIdPrefix="mlb-season-stat"
      away={detail.away}
      home={detail.home}
      rows={rows}
    />
  );
}
