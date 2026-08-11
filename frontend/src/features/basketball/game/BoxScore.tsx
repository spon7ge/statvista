import type { GameDetail, GameDetailBoxScorePlayer, GameDetailTeam } from "../lib/types";
import { GameSection } from "@/shared/ui/GameSection";

const STAT_COLS =
  "grid-cols-[minmax(8rem,1.3fr)_repeat(14,minmax(2.25rem,1fr))]";

function TeamBoxScore({
  team,
  players,
  columns,
  testId,
}: {
  team: GameDetailTeam;
  players: GameDetailBoxScorePlayer[];
  columns: string[];
  testId: string;
}) {
  return (
    <GameSection data-testid={testId} className="!p-3">
      <div className="overflow-x-auto">
        <div className="mb-2 flex items-center gap-2 text-[18px]">
          {team.logoUrl ? (
            <img src={team.logoUrl} alt="" className="size-6 object-contain" />
          ) : null}
          <span className="font-semibold" style={{ color: team.color }}>
            {team.abbrev}
          </span>
          <span className="font-medium text-white/90">{team.name}</span>
        </div>

        <div
          className={`grid ${STAT_COLS} gap-x-1.5 border-b border-white/[0.08] pb-1.5 text-[14px] tracking-wide text-white/40`}
        >
          <span>Player</span>
          {columns.map((column) => (
            <span key={column} className="text-right uppercase">
              {column}
            </span>
          ))}
        </div>

        <ul>
          {players.map((player) => (
            <li
              key={`${team.id}-${player.name}`}
              className={`grid ${STAT_COLS} gap-x-1.5 border-b border-white/[0.06] py-1.5 text-[18px]`}
            >
              <span className="truncate text-white">{player.name}</span>
              {player.didNotPlay ? (
                <>
                  {columns.slice(0, -1).map((column) => (
                    <span key={column} className="text-right text-white/30" />
                  ))}
                  <span className="text-right text-white/45">DNP</span>
                </>
              ) : (
                player.values.map((value, index) => (
                  <span
                    key={`${player.name}-${columns[index] ?? index}`}
                    className="text-right tabular-nums text-white/85"
                  >
                    {value}
                  </span>
                ))
              )}
            </li>
          ))}
        </ul>
      </div>
    </GameSection>
  );
}

export function BoxScore({ detail }: { detail: GameDetail }) {
  const boxScore = detail.boxScore;
  if (!boxScore) {
    return null;
  }
  if (boxScore.away.length === 0 && boxScore.home.length === 0) {
    return null;
  }

  return (
    <div data-testid="wnba-box-score" className="space-y-4">
      {boxScore.away.length > 0 ? (
        <TeamBoxScore
          testId="wnba-box-team-away"
          team={detail.away}
          players={boxScore.away}
          columns={boxScore.columns}
        />
      ) : null}
      {boxScore.home.length > 0 ? (
        <TeamBoxScore
          testId="wnba-box-team-home"
          team={detail.home}
          players={boxScore.home}
          columns={boxScore.columns}
        />
      ) : null}
    </div>
  );
}
