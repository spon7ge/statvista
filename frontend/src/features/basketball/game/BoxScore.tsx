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
        <div className="mb-2 flex items-center gap-2 text-[16px]">
          {team.logoUrl ? (
            <img src={team.logoUrl} alt="" className="size-6 object-contain" />
          ) : null}
          <span className="font-semibold" style={{ color: team.color }}>
            {team.abbrev}
          </span>
          <span className="font-medium text-c3">{team.name}</span>
        </div>

        <div
          className={`grid ${STAT_COLS} gap-x-1.5 border-b border-line pb-1.5 text-[14px] tracking-wide text-c3`}
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
              className={`grid ${STAT_COLS} gap-x-1.5 border-b border-line py-1.5 text-[16px]`}
            >
              <span className="truncate text-c3">{player.name}</span>
              {player.didNotPlay ? (
                <>
                  {columns.slice(0, -1).map((column) => (
                    <span key={column} className="text-right text-c3" />
                  ))}
                  <span className="text-right text-c3">DNP</span>
                </>
              ) : (
                player.values.map((value, index) => (
                  <span
                    key={`${player.name}-${columns[index] ?? index}`}
                    className="text-right tabular-nums text-c3"
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
