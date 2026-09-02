import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatvistaBarsMark } from "@/shared/ui/StatvistaBarsMark";
import type { MlbPropAppTab } from "./MlbPropPicksHeader";
import type { MlbPropPlayerCard } from "./groupMlbPropPlayers";

export const MLB_PROP_PICKS_PAGE_SIZE = 20;

export function formatMlbPropPicksUpdatedAt(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

/**
 * Round-robin into columns so visual rows stay rank order (1,2,3 then
 * 4,5,6…) while each column is independent.
 */
export function splitPropsIntoColumns<T>(
  items: T[],
  columnCount: number,
): T[][] {
  const n = Math.max(1, Math.floor(columnCount));
  const cols: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => {
    cols[i % n]!.push(item);
  });
  return cols;
}

function usePropPicksColumnCount(): number {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const md = window.matchMedia("(min-width: 768px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    function sync() {
      if (lg.matches) setCount(3);
      else if (md.matches) setCount(2);
      else setCount(1);
    }
    sync();
    md.addEventListener("change", sync);
    lg.addEventListener("change", sync);
    return () => {
      md.removeEventListener("change", sync);
      lg.removeEventListener("change", sync);
    };
  }, []);

  return count;
}

function Skeletons({ columnCount }: { columnCount: number }) {
  const perCol = Math.ceil(6 / columnCount);
  return (
    <div
      className="flex gap-3"
      aria-label="Loading MLB prop picks"
    >
      {Array.from({ length: columnCount }, (_, col) => (
        <div key={col} className="flex min-w-0 flex-1 flex-col gap-3">
          {Array.from({ length: perCol }, (_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded bg-c2"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function teamPosLabel(team: string | null, pos: string | null): string | null {
  const parts = [team, pos].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function PlayerCard({
  player,
  app,
}: {
  player: MlbPropPlayerCard;
  app: MlbPropAppTab;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = teamPosLabel(player.team_abbrev, player.position);
  const showImg = Boolean(player.headshot_url) && !imgFailed;
  const initial = (player.player_name.trim()[0] ?? "?").toUpperCase();

  return (
    <article
      data-testid="mlb-prop-row"
      className="relative rounded bg-c2 p-4 ring-2 ring-transparent transition-[box-shadow] hover:ring-[#059669]"
    >
      <StatvistaBarsMark className="pointer-events-none absolute left-3 top-3 size-4 text-c3" />
      <div className="flex flex-col items-center text-center">
        {showImg ? (
          <img
            src={player.headshot_url!}
            alt={player.player_name}
            className="size-16 rounded-full object-cover bg-c2"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span
            data-testid="mlb-prop-headshot-fallback"
            className="flex size-16 items-center justify-center rounded-full bg-c2 text-lg font-semibold text-c3"
          >
            {initial}
          </span>
        )}
        {meta ? (
          <p className="mt-2 text-[14px] text-c3">{meta}</p>
        ) : null}
        <p className="mt-1 text-[16px] font-semibold text-c3">
          {player.player_name}
        </p>
        <Link
          to={`/mlb/prop_picks/player/${player.player_slug}?app=${app}`}
          className="mt-3 inline-flex rounded-full bg-c2 px-3 py-1.5 text-[14px] font-semibold text-black"
        >
          View {player.prop_count} {player.prop_count === 1 ? "prop" : "props"}
        </Link>
      </div>
    </article>
  );
}

export type MlbPropPicksListProps = {
  players: MlbPropPlayerCard[];
  app: MlbPropAppTab;
  isLoading?: boolean;
  isError?: boolean;
  /** True when filters hid all players (API still returned props). */
  filtersActive?: boolean;
  /** Override default empty/error copy when set (e.g. missing app snapshot). */
  emptyMessage?: string;
  /** Epoch ms of last successful props API fetch (React Query dataUpdatedAt). */
  lastUpdatedAt?: number;
};

export function MlbPropPicksList({
  players,
  app,
  isLoading = false,
  isError = false,
  filtersActive = false,
  emptyMessage,
  lastUpdatedAt,
}: MlbPropPicksListProps) {
  const [page, setPage] = useState(0);
  const columnCount = usePropPicksColumnCount();

  // Reset when the result set identity changes (not on every new array ref).
  const listSignature = `${players.length}:${players[0]?.player_slug ?? ""}:${players[players.length - 1]?.player_slug ?? ""}`;
  useEffect(() => {
    setPage(0);
  }, [listSignature]);

  const totalPages = Math.max(
    1,
    Math.ceil(players.length / MLB_PROP_PICKS_PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * MLB_PROP_PICKS_PAGE_SIZE;
  const pagePlayers = players.slice(start, start + MLB_PROP_PICKS_PAGE_SIZE);
  const end = start + pagePlayers.length;
  const showPager = players.length > MLB_PROP_PICKS_PAGE_SIZE;
  const columns = splitPropsIntoColumns(pagePlayers, columnCount);

  const emptyCopy =
    emptyMessage ??
    (filtersActive && !isError
      ? "No props match these filters"
      : "Prop lines unavailable");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-end gap-2">
        {lastUpdatedAt ? (
          <p className="text-[14px] text-c3">
            Last updated {formatMlbPropPicksUpdatedAt(lastUpdatedAt)}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <Skeletons columnCount={columnCount} />
      ) : isError || players.length === 0 ? (
        <p className="px-1 text-[14px] text-c3">{emptyCopy}</p>
      ) : (
        <>
          <div
            data-testid="mlb-prop-picks-grid"
            className="flex gap-3"
          >
            {columns.map((colPlayers, colIdx) => (
              <div
                key={colIdx}
                data-testid="mlb-prop-picks-column"
                className="flex min-w-0 flex-1 flex-col gap-3"
              >
                {colPlayers.map((player) => (
                  <PlayerCard
                    key={`${player.player_name}|${player.team_abbrev ?? ""}`}
                    player={player}
                    app={app}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[14px] text-c3">
              Showing {start + 1}–{end} of {players.length}
            </p>
            {showPager ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded border border-line px-2.5 py-0.5 text-[14px] text-c3 enabled:hover:text-c4 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Previous
                </button>
                <span className="text-[14px] text-c3">
                  Page {safePage + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  className="rounded border border-line px-2.5 py-0.5 text-[14px] text-c3 enabled:hover:text-c4 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
