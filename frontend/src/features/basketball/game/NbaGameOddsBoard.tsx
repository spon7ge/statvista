import { GameSection } from "@/shared/ui/GameSection";
import type {
  NbaOddsBoardTile,
  NbaOddsBookBoardView,
} from "../lib/nbaOddsBoard";
import { formatAmericanOdds } from "../lib/wnbaOddsBoard";
import type { GameDetail, GameDetailTeam } from "../lib/types";

function line(tile: NbaOddsBoardTile): string | null {
  if (tile.kind === "money" || tile.line == null) return null;
  if (tile.kind === "total") {
    return `${tile.side === "over" ? "o" : "u"}${tile.line}`;
  }
  return tile.line > 0 ? `+${tile.line}` : String(tile.line);
}

function Tile({ tile }: { tile: NbaOddsBoardTile }) {
  const price = tile.price == null ? "–" : formatAmericanOdds(tile.price);
  const value = line(tile);
  return (
    <div className="flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded bg-c2 px-2 py-1.5 text-center">
      <p className="truncate text-sm font-semibold leading-tight text-c3">
        {value ?? price}
      </p>
      {value ? (
        <p className="mt-0.5 truncate text-[12px] font-medium leading-tight text-c3">
          {price}
        </p>
      ) : null}
    </div>
  );
}

function TeamRow({
  team,
  row,
}: {
  team: GameDetailTeam;
  row: NbaOddsBookBoardView["rows"][number];
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
      <div className="flex min-w-0 items-center gap-1.5">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt="" className="size-5 object-contain" />
        ) : null}
        <span className="truncate text-sm font-semibold text-c3">
          {team.abbrev}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Tile tile={row.money} />
        <Tile tile={row.total} />
        <Tile tile={row.spread} />
      </div>
    </div>
  );
}

export function NbaGameOddsBoard({
  detail,
  boards,
  isPending,
}: {
  detail: Pick<GameDetail, "away" | "home">;
  boards: NbaOddsBookBoardView[];
  isPending?: boolean;
}) {
  return (
    <GameSection data-testid="nba-game-odds-board">
      <h2 className="mb-3 font-semibold text-c3">Odds</h2>
      {isPending ? (
        <p className="text-[16px] text-c3">Loading odds…</p>
      ) : boards.length === 0 ? (
        <p className="text-[16px] text-c3">Odds unavailable</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 text-center text-[12px] uppercase text-c3">
            <span />
            <div className="grid grid-cols-3 gap-1.5">
              <span>Money</span>
              <span>Total</span>
              <span>Spread</span>
            </div>
          </div>
          {boards.map((board) => (
            <div key={board.sportsbook} className="space-y-2">
              <TeamRow team={detail.away} row={board.rows[0]} />
              <TeamRow team={detail.home} row={board.rows[1]} />
              <p
                data-testid={`nba-odds-book-${board.sportsbook}`}
                className="ml-[5.25rem] text-xs text-c3"
              >
                {board.sportsbook}
              </p>
            </div>
          ))}
        </div>
      )}
    </GameSection>
  );
}
