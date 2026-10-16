import { GameSection } from "@/shared/ui/GameSection";
import type {
  GameDetail,
  GameDetailSeasonTeamStatLine,
} from "../lib/types";

const STATS = [
  ["pts", "ptsRank", "PTS"],
  ["fgPct", "fgPctRank", "FG%"],
  ["fg3Pct", "fg3PctRank", "3P%"],
  ["ftPct", "ftPctRank", "FT%"],
  ["reb", "rebRank", "REB"],
  ["ast", "astRank", "AST"],
  ["stl", "stlRank", "STL"],
  ["blk", "blkRank", "BLK"],
  ["to", "toRank", "TO"],
] as const satisfies ReadonlyArray<
  readonly [
    keyof GameDetailSeasonTeamStatLine,
    keyof GameDetailSeasonTeamStatLine,
    string,
  ]
>;

function value(input: string | number | null): string {
  if (input == null || input === "") return "–";
  return typeof input === "number" && !Number.isInteger(input)
    ? input.toFixed(1)
    : String(input);
}

export function NbaSeasonTeamStats({ detail }: { detail: GameDetail }) {
  if (!detail.seasonTeamStats) return null;
  return (
    <GameSection data-testid="nba-season-team-stats" className="w-full !p-3">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="font-semibold text-c3">{detail.away.abbrev}</span>
        <h2 className="font-semibold text-c3">Team Stats</h2>
        <span className="text-right font-semibold text-c3">
          {detail.home.abbrev}
        </span>
      </div>
      {STATS.map(([stat, rank, label]) => (
        <div
          key={stat}
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line py-2 last:border-b-0"
        >
          <span className="tabular-nums text-c3">
            {value(detail.seasonTeamStats!.away[stat])}
            {detail.seasonTeamStats!.away[rank] != null
              ? ` #${detail.seasonTeamStats!.away[rank]}`
              : ""}
          </span>
          <span className="text-center text-c3">{label}</span>
          <span className="text-right tabular-nums text-c3">
            {value(detail.seasonTeamStats!.home[stat])}
            {detail.seasonTeamStats!.home[rank] != null
              ? ` #${detail.seasonTeamStats!.home[rank]}`
              : ""}
          </span>
        </div>
      ))}
    </GameSection>
  );
}
