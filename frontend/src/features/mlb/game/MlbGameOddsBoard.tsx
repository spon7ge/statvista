import { GameSection } from "@/shared/ui/GameSection";
import {
  formatAmericanOdds,
  type MlbOddsBoardTile,
  type MlbOddsBookBoardView,
} from "../lib/mlbOddsBoard";
import type { MlbGameDetailTeam, MlbGameDetailView } from "../lib/types";

type Props = {
  detail: Pick<MlbGameDetailView, "away" | "home">;
  boards: MlbOddsBookBoardView[];
  isPending?: boolean;
};

function formatAsOf(asOf: string | null): string | null {
  if (!asOf) return null;

  const timestamp = new Date(asOf);
  if (Number.isNaN(timestamp.getTime())) return asOf;

  return timestamp.toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Known sportsbook slugs keep their house casing; anything else is title-cased. */
const SPORTSBOOK_LABELS: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  novig: "Novig",
  pinnacle: "Pinnacle",
  prophetx: "ProphetX",
};

function formatSportsbook(sportsbook: string | null | undefined): string | null {
  const raw = sportsbook?.trim();
  if (!raw) return null;
  return SPORTSBOOK_LABELS[raw.toLowerCase()] ?? raw[0].toUpperCase() + raw.slice(1);
}

function formatTileLine(tile: MlbOddsBoardTile): string | null {
  if (tile.kind === "money" || tile.line == null) return null;
  if (tile.kind === "total") return `${tile.side === "over" ? "o" : "u"}${tile.line}`;
  return tile.line > 0 ? `+${tile.line}` : String(tile.line);
}

function OddsTile({ tile }: { tile: MlbOddsBoardTile }) {
  const line = formatTileLine(tile);
  const price = tile.price == null ? null : formatAmericanOdds(tile.price);
  const primary = line ?? "–";
  const secondary = price ?? "–";

  return (
    <div className="flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded-lg bg-white/10 px-2 py-1.5 text-center">
      <p className="truncate text-sm font-semibold leading-tight text-white">
        {primary}
      </p>
      <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-white/45">
        {secondary}
      </p>
    </div>
  );
}

function BookmakerCell({ label }: { label: string | null }) {
  return (
    <div className="flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded-lg bg-white/10 px-2 py-1.5 text-center">
      <p className="truncate text-sm font-semibold leading-tight text-white">
        {label ?? "\u00a0"}
      </p>
    </div>
  );
}

const COLUMN_LABELS = ["Bookmaker", "Total", "Spread"] as const;

function OddsColumnHeaders() {
  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3"
      aria-hidden="true"
    >
      <div className="min-w-12" />
      <div className="grid grid-cols-3 gap-1.5">
        {COLUMN_LABELS.map((label) => (
          <p
            key={label}
            className="text-center text-[11px] font-medium uppercase tracking-wide text-white/45"
          >
            {label}
          </p>
        ))}
      </div>
    </div>
  );
}

function TeamOddsRow({
  team,
  row,
  bookmaker,
}: {
  team: MlbGameDetailTeam;
  row: MlbOddsBookBoardView["rows"][number];
  bookmaker: string | null;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
      <div className="flex min-w-12 items-center gap-1.5">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt="" className="size-5 object-contain" />
        ) : null}
        <span className="text-sm font-semibold text-white">{team.abbrev}</span>
      </div>
      <div className="grid grid-cols-3 items-stretch gap-1.5">
        <BookmakerCell label={bookmaker} />
        <OddsTile tile={row.total} />
        <OddsTile tile={row.spread} />
      </div>
    </div>
  );
}

function BookOddsBlock({
  detail,
  board,
}: {
  detail: Pick<MlbGameDetailView, "away" | "home">;
  board: MlbOddsBookBoardView;
}) {
  const awayRow = board.rows.find((row) => row.side === "away");
  const homeRow = board.rows.find((row) => row.side === "home");
  const bookmaker = formatSportsbook(board.sportsbook);

  if (!awayRow || !homeRow) return null;

  return (
    <div className="space-y-2">
      <TeamOddsRow team={detail.away} row={awayRow} bookmaker={bookmaker} />
      <TeamOddsRow team={detail.home} row={homeRow} bookmaker={null} />
    </div>
  );
}

export function MlbGameOddsBoard({ detail, boards, isPending }: Props) {
  const asOf = formatAsOf(boards[0]?.asOf ?? null);
  const completeBoards = boards.filter((board) => {
    const awayRow = board.rows.find((row) => row.side === "away");
    const homeRow = board.rows.find((row) => row.side === "home");
    return Boolean(awayRow && homeRow);
  });

  return (
    <GameSection data-testid="mlb-game-odds-board">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[18px] font-semibold text-white">Odds</h2>
        {asOf ? (
          <p className="text-right text-xs text-white/50">{asOf}</p>
        ) : null}
      </div>
      {isPending ? (
        <p className="text-[18px] text-white/50">Loading odds…</p>
      ) : completeBoards.length === 0 ? (
        <p className="text-[18px] text-white/50">Odds unavailable</p>
      ) : (
        <div className="space-y-4">
          <OddsColumnHeaders />
          {completeBoards.map((board) => (
            <BookOddsBlock
              key={board.sportsbook}
              detail={detail}
              board={board}
            />
          ))}
        </div>
      )}
    </GameSection>
  );
}
