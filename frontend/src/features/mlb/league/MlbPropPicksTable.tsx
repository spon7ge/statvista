import { useEffect, useMemo, useState } from "react";
import type { ApiMlbPropBoardRow } from "@/shared/lib/api";
import betMgmIcon from "@/assets/betmgm-icon.svg?raw";
import caesarsIcon from "@/assets/caesars-icon.svg?raw";
import draftKingsIcon from "@/assets/draftkings-icon.svg?raw";
import fanDuelIcon from "@/assets/fanduel-icon.svg?raw";
import fliffIcon from "@/assets/fliff-icon.svg?raw";
import novigIcon from "@/assets/novig-icon.svg?raw";
import prizePicksIcon from "@/assets/prizepicks-icon.svg?raw";
import prophetXIcon from "@/assets/prophetx-icon.svg?raw";
import underdogIcon from "@/assets/underdog-icon.svg?raw";
import { bookDisplayName } from "@/features/mlb/lib/mlbBookLabels";
import { formatAmericanOdds } from "@/features/mlb/lib/mlbOddsBoard";
import { formatMlbPropPicksUpdatedAt } from "./MlbPropPicksList";
import {
  orderedBoardBooks,
  sortMlbPropBoardRows,
  type MlbPropBoardSort,
  type MlbPropBoardSortKey,
} from "./sortMlbPropBoard";

const VISIBLE_ODDS_CHIPS = 4;
export const MLB_PROP_BOARD_PAGE_SIZE = 30;
const PRIZEPICKS_AMERICAN = -137;

// Inline SVGs so `currentColor` paints on the dark table.
// `fliff` is the board key for fliff-icon.svg.
const BOOK_SVGS: Record<string, string> = {
  betmgm: betMgmIcon,
  caesars: caesarsIcon,
  draftkings: draftKingsIcon,
  fanduel: fanDuelIcon,
  fliff: fliffIcon,
  novig: novigIcon,
  prizepicks: prizePicksIcon,
  prophetx: prophetXIcon,
  underdog: underdogIcon,
};

const BOOK_SHORT: Record<string, string> = {
  prophetx: "PX",
  novig: "NV",
  pinnacle: "PIN",
  draftkings: "DK",
  fanduel: "FD",
  betmgm: "MGM",
  caesars: "CZR",
  bet365: "365",
  kalshi: "KAL",
  fliff: "FLF",
  prizepicks: "PP",
  underdog: "UD",
};

type MlbPropPicksTableProps = {
  rows: ApiMlbPropBoardRow[];
  isLoading?: boolean;
  isError?: boolean;
  lastUpdatedAt?: number;
  /** When set, sort that hit-rate column highest → lowest. */
  hitRateWindow?: "l5" | "l10" | "l15" | null;
};

const COLUMNS: { key: MlbPropBoardSortKey; label: string }[] = [
  { key: "player", label: "Proposition" },
  { key: "line", label: "Line" },
  { key: "odds", label: "Odds" },
  { key: "ip", label: "IP" },
  { key: "def", label: "Opp Def Rank" },
  { key: "pace", label: "Opp Pace Rank" },
  { key: "l5", label: "L5" },
  { key: "l10", label: "L10" },
  { key: "l15", label: "L15" },
];

function formatMatchup(row: ApiMlbPropBoardRow): string | null {
  if (!row.team_abbrev || !row.opponent_abbrev) return null;
  return row.home_away === "home"
    ? `${row.opponent_abbrev} @ ${row.team_abbrev}`
    : `${row.team_abbrev} @ ${row.opponent_abbrev}`;
}

function dashOr(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function hitToneClass(pct: number | null): string {
  if (pct == null) return "text-white/45";
  if (pct >= 67) return "bg-emerald-500/20 text-emerald-300";
  if (pct >= 45) return "bg-amber-500/20 text-amber-300";
  return "bg-rose-500/20 text-rose-300";
}

function rankToneClass(rank: number | null): string {
  if (rank == null) return "";
  // Rank 1 is toughest (warm); easier clubs cool toward green.
  if (rank <= 10) return "bg-rose-500/20 text-rose-200";
  if (rank <= 20) return "bg-amber-500/20 text-amber-200";
  return "bg-emerald-500/20 text-emerald-200";
}

function BookMark({ book, label }: { book: string; label: string }) {
  const svg = BOOK_SVGS[book];
  if (svg) {
    return (
      <span
        className="inline-flex size-3.5 shrink-0 text-white [&_svg]:block [&_svg]:size-3.5"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  const short = BOOK_SHORT[book] ?? label.slice(0, 3).toUpperCase();
  return (
    <span className="text-[10px] font-semibold tracking-wide text-white/70">
      {short}
    </span>
  );
}

function BookChip({
  book,
  american,
  url,
}: {
  book: string;
  american: number | null;
  url: string | null;
}) {
  const label = bookDisplayName(book);
  const displayAmerican = postedAmerican(book, american);
  if (displayAmerican == null) return null;
  const inner = (
    <>
      <BookMark book={book} label={label} />
      <span className="font-mono text-[11px] text-white">
        {formatAmericanOdds(displayAmerican)}
      </span>
    </>
  );
  const className = "inline-flex items-center gap-1";
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`${className} hover:opacity-80`}
        aria-label={label}
      >
        {inner}
      </a>
    );
  }
  return (
    <span className={className} aria-label={label}>
      {inner}
    </span>
  );
}

function postedAmerican(
  book: string,
  american: number | null,
): number | null {
  if (book === "prizepicks") return PRIZEPICKS_AMERICAN;
  return american;
}

function OddsCell({ row }: { row: ApiMlbPropBoardRow }) {
  const books = orderedBoardBooks(row.books).filter(
    (chip) => postedAmerican(chip.book, chip.american) != null,
  );
  const visible = books.slice(0, VISIBLE_ODDS_CHIPS);
  const overflow = books.length - visible.length;
  return (
    <div data-testid="odds-cell" className="flex flex-wrap items-center gap-1">
      {visible.map((chip) => (
        <BookChip
          key={chip.book}
          book={chip.book}
          american={chip.american}
          url={chip.url}
        />
      ))}
      {overflow > 0 ? (
        <span className="text-[11px] font-medium text-white/45">+{overflow}</span>
      ) : null}
    </div>
  );
}

function CompositeCell({ row }: { row: ApiMlbPropBoardRow }) {
  const matchup = formatMatchup(row);
  const initial = (row.player_name.trim()[0] ?? "?").toUpperCase();
  return (
    <div className="flex min-w-[14rem] items-center gap-2.5">
      {row.headshot_url ? (
        <img
          src={row.headshot_url}
          alt=""
          className="size-8 shrink-0 rounded-full bg-white/10 object-cover"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/50">
          {initial}
        </span>
      )}
      <div className="min-w-0">
        <p data-testid="board-row-headline" className="truncate text-sm">
          <span
            data-testid="board-row-name"
            className="font-bold text-white"
          >
            {row.player_name}
          </span>
          {matchup ? (
            <span className="text-white/45"> · {matchup}</span>
          ) : null}
        </p>
        <p
          data-testid="board-row-market"
          className="truncate text-[12px] text-white/70"
        >
          {row.market_label}
        </p>
      </div>
    </div>
  );
}

function RankCell({
  testId,
  rank,
  label,
}: {
  testId: string;
  rank: number | null;
  label: string | null;
}) {
  return (
    <td className="px-2 py-2" data-testid={testId}>
      {rank == null || !label ? (
        <span className="text-white/45">—</span>
      ) : (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${rankToneClass(rank)}`}
        >
          {label}
        </span>
      )}
    </td>
  );
}

function HitCell({
  testId,
  value,
}: {
  testId: string;
  value: number | null;
}) {
  return (
    <td className="px-2 py-2 text-center" data-testid={testId}>
      <span
        className={`inline-flex min-w-[2.25rem] justify-center rounded-md px-1.5 py-0.5 text-[12px] font-medium ${hitToneClass(value)}`}
      >
        {value == null ? "—" : `${value}%`}
      </span>
    </td>
  );
}

export function MlbPropPicksTable({
  rows,
  isLoading = false,
  isError = false,
  lastUpdatedAt,
  hitRateWindow = null,
}: MlbPropPicksTableProps) {
  const [sort, setSort] = useState<MlbPropBoardSort | null>(null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => sortMlbPropBoardRows(rows, sort), [rows, sort]);

  useEffect(() => {
    if (hitRateWindow) {
      setSort({ key: hitRateWindow, direction: "desc" });
    } else {
      setSort(null);
    }
    setPage(0);
  }, [hitRateWindow]);

  const listSignature = `${rows.length}:${rows[0]?.player_name ?? ""}:${rows[rows.length - 1]?.player_name ?? ""}:${rows[0]?.stat ?? ""}:${rows[rows.length - 1]?.stat ?? ""}`;
  useEffect(() => {
    setPage(0);
  }, [listSignature]);

  const totalPages = Math.max(
    1,
    Math.ceil(sorted.length / MLB_PROP_BOARD_PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * MLB_PROP_BOARD_PAGE_SIZE;
  const pageRows = sorted.slice(start, start + MLB_PROP_BOARD_PAGE_SIZE);
  const end = start + pageRows.length;
  const showPager = sorted.length > MLB_PROP_BOARD_PAGE_SIZE;

  function onSort(key: MlbPropBoardSortKey) {
    setPage(0);
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  }

  return (
    <section className="space-y-3">
      {lastUpdatedAt ? (
        <p className="text-right text-[14px] text-white/40">
          Last updated {formatMlbPropPicksUpdatedAt(lastUpdatedAt)}
        </p>
      ) : null}

      {isLoading ? (
        <div
          aria-label="Loading MLB prop picks"
          className="h-64 animate-pulse rounded-xl bg-[#1c1e22]"
        />
      ) : isError ? (
        <p className="px-1 text-[14px] text-white/40">Prop lines unavailable</p>
      ) : sorted.length === 0 ? (
        <p className="px-1 text-[14px] text-white/40">No board yet</p>
      ) : (
        <>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-left">
            <thead className="sticky top-0">
              <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wide text-white/70">
                {COLUMNS.map((column) => {
                  const active = sort?.key === column.key;
                  const ariaSort = !active
                    ? "none"
                    : sort.direction === "asc"
                      ? "ascending"
                      : "descending";
                  return (
                    <th
                      key={column.key}
                      className="px-2 py-2 font-semibold"
                      aria-sort={ariaSort}
                    >
                      <button
                        type="button"
                        onClick={() => onSort(column.key)}
                        className="bg-transparent p-0 text-left uppercase tracking-wide text-white/70 hover:text-white"
                      >
                        {column.label}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr
                  key={`${row.player_name}:${row.stat}:${row.side}:${row.line}:${row.game_pk ?? ""}`}
                  className="border-b border-white/5"
                >
                  <td className="px-2 py-2">
                    <CompositeCell row={row} />
                  </td>
                  <td className="px-2 py-2 font-mono text-sm text-white">
                    {row.line}
                  </td>
                  <td className="px-2 py-2">
                    <OddsCell row={row} />
                  </td>
                  <td className="px-2 py-2 font-mono text-sm text-white" data-testid="ip-cell">
                    {dashOr(row.ip_pct)}
                  </td>
                  <RankCell
                    testId="opp-def-cell"
                    rank={row.opp_def_rank}
                    label={row.opp_def_label}
                  />
                  <RankCell
                    testId="opp-pace-cell"
                    rank={row.opp_pace_rank}
                    label={row.opp_pace_label}
                  />
                  <HitCell testId="hit-l5-cell" value={row.hit_l5} />
                  <HitCell testId="hit-l10-cell" value={row.hit_l10} />
                  <HitCell testId="hit-l15-cell" value={row.hit_l15} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[14px] text-white/40">
              Showing {start + 1}–{end} of {sorted.length}
            </p>
            {showPager ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-md border border-white/10 px-2.5 py-0.5 text-[14px] text-white/55 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Previous
                </button>
                <span className="text-[14px] text-white/35">
                  Page {safePage + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  className="rounded-md border border-white/10 px-2.5 py-0.5 text-[14px] text-white/55 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
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
