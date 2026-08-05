import { GameSection } from "@/shared/ui/GameSection";
import { formatAmericanOdds, type MlbOddsBoardTile, type MlbOddsBoardView } from "../lib/mlbOddsBoard";
import type { MlbGameDetailTeam, MlbGameDetailView } from "../lib/types";

type Props = {
  detail: Pick<MlbGameDetailView, "away" | "home">;
  view: MlbOddsBoardView | null;
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
  pinnacle: "Pinnacle",
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

function OddsTile({ label, tile }: { label: string; tile: MlbOddsBoardTile }) {
  const line = formatTileLine(tile);
  const price = tile.price == null ? null : formatAmericanOdds(tile.price);

  return (
    <div className="min-w-0 rounded-lg bg-white/10 px-2 py-1.5 text-center">
      <p className="text-[11px] font-medium text-white/45">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-white">
        {tile.kind === "money" ? (
          price ?? "–"
        ) : line ? (
          <>
            <span>{line}</span>
            <span className="ml-1">{price ?? "–"}</span>
          </>
        ) : (
          "–"
        )}
      </p>
    </div>
  );
}

function TeamOddsRow({
  team,
  row,
}: {
  team: MlbGameDetailTeam;
  row: MlbOddsBoardView["rows"][number];
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
      <div className="flex min-w-12 items-center gap-1.5">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt="" className="size-5 object-contain" />
        ) : null}
        <span className="text-sm font-semibold text-white">{team.abbrev}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <OddsTile label="Money" tile={row.money} />
        <OddsTile label="Total" tile={row.total} />
        <OddsTile label="Spread" tile={row.spread} />
      </div>
    </div>
  );
}

export function MlbGameOddsBoard({ detail, view, isPending }: Props) {
  const asOf = formatAsOf(view?.asOf ?? null);
  const sportsbook = formatSportsbook(view?.sportsbook);
  const awayRow = view?.rows.find((row) => row.side === "away");
  const homeRow = view?.rows.find((row) => row.side === "home");

  return (
    <GameSection data-testid="mlb-game-odds-board">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[18px] font-semibold text-white">Odds</h2>
        {sportsbook || asOf ? (
          <p className="text-right text-xs text-white/50">
            {[sportsbook, asOf].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
      {isPending ? (
        <p className="text-[18px] text-white/50">Loading odds…</p>
      ) : !view || !awayRow || !homeRow ? (
        <p className="text-[18px] text-white/50">Odds unavailable</p>
      ) : (
        <div className="space-y-2">
          <TeamOddsRow team={detail.away} row={awayRow} />
          <TeamOddsRow team={detail.home} row={homeRow} />
        </div>
      )}
    </GameSection>
  );
}
