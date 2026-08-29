import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
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
import { mlbTeamLogoUrl } from "./mlbTeamLogos";
import {
  orderedBoardBooks,
  orderedDfsBooks,
  sortMlbPropBoardRows,
  type MlbPropBoardSort,
  type MlbPropBoardSortKey,
} from "./sortMlbPropBoard";
const VISIBLE_ODDS_CHIPS = 3;
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
  /** When set, sort that hit-rate column highest → lowest. */
  hitRateWindow?: "l5" | "l10" | "l15" | null;
};

const COLUMNS: {
  key: MlbPropBoardSortKey | "dfs";
  label: string;
  sortable: boolean;
}[] = [
  { key: "player", label: "Proposition", sortable: true },
  { key: "line", label: "Line", sortable: true },
  { key: "dfs", label: "DFS", sortable: false },
  { key: "odds", label: "Odds", sortable: true },
  { key: "ip", label: "IP", sortable: true },
  { key: "l5", label: "L5", sortable: true },
  { key: "l10", label: "L10", sortable: true },
  { key: "l15", label: "L15", sortable: true },
  { key: "h2h", label: "H2H", sortable: true },
];

const HIT_SORT_KEYS = new Set<MlbPropBoardSortKey>(["l5", "l10", "l15", "h2h"]);

const ROW_BOX_BG =
  "bg-white/[0.04] transition-colors group-hover:bg-white/[0.08]";
const ROW_BOX_BORDER = "border-white/10 group-hover:border-white/20";
const ROW_BOX_FIRST = `rounded-l-lg border-y border-l ${ROW_BOX_BG} ${ROW_BOX_BORDER}`;
const ROW_BOX_MIDDLE = `border-y ${ROW_BOX_BG} ${ROW_BOX_BORDER}`;
const ROW_BOX_LAST = "rounded-r-lg border-r";

function formatMatchup(row: ApiMlbPropBoardRow): string | null {
  if (!row.team_abbrev || !row.opponent_abbrev) return null;
  return row.home_away === "home"
    ? `${row.opponent_abbrev} @ ${row.team_abbrev}`
    : `${row.team_abbrev} @ ${row.opponent_abbrev}`;
}

function hitBoxClass(pct: number | null): string {
  if (pct == null) return `${ROW_BOX_BG} text-white/45`;
  if (pct >= 67) return "bg-emerald-500/15 text-emerald-300";
  if (pct >= 45) return "bg-amber-500/15 text-amber-300";
  return "bg-rose-500/15 text-rose-300";
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
  const boldMark = book === "pinnacle" || book === "bet365";
  return (
    <span
      className={`text-[10px] tracking-wide text-white/70 ${
        boldMark ? "font-bold" : "font-semibold"
      }`}
    >
      {short}
    </span>
  );
}

function BookChip({
  book,
  american,
  url,
  line = null,
}: {
  book: string;
  american: number | null;
  url: string | null;
  line?: number | null;
}) {
  const label = bookDisplayName(book);
  const displayAmerican = postedAmerican(book, american);
  if (displayAmerican == null) return null;
  const oddsText = formatAmericanOdds(displayAmerican);
  const lineText = line != null ? String(line) : null;
  const aria = [label, lineText, oddsText].filter(Boolean).join(" ");
  const inner = (
    <>
      <BookMark book={book} label={label} />
      <span className="font-mono text-[11px] text-white">
        {lineText != null ? <span>{lineText} </span> : null}
        {oddsText}
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
        aria-label={aria}
      >
        {inner}
      </a>
    );
  }
  return (
    <span className={className} aria-label={aria}>
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

function OddsOverflow({ chips }: { chips: ApiMlbPropBoardRow["books"] }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  }

  if (chips.length === 0) return null;

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex items-center gap-0.5 text-[11px] font-medium text-white/45"
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
      >
        <span>+{chips.length}</span>
        <button
          type="button"
          data-testid="odds-overflow-arrow"
          aria-label={`${chips.length} more books`}
          className="inline-flex bg-transparent p-0 text-white/45 hover:text-white/70"
          onFocus={show}
          onBlur={() => setOpen(false)}
        >
          <ChevronDown
            className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </span>
      {open
        ? // Portal so the table's overflow-x-auto wrapper cannot clip the tooltip.
          createPortal(
            <div
              role="tooltip"
              data-testid="odds-overflow-panel"
              className="pointer-events-none fixed z-50 flex min-w-[6rem] flex-col gap-1.5 rounded-lg border border-white/10 bg-[#1c1e22] px-2.5 py-2 shadow-lg"
              style={{ top: pos.top, left: pos.left }}
            >
              {chips.map((chip) => (
                <BookChip
                  key={chip.book}
                  book={chip.book}
                  american={chip.american}
                  url={chip.url}
                  line={chip.line}
                />
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function DfsCell({ row }: { row: ApiMlbPropBoardRow }) {
  const chips = orderedDfsBooks(row.dfs ?? []).filter(
    (chip) => postedAmerican(chip.book, chip.american) != null,
  );
  if (chips.length === 0) {
    return (
      <div data-testid="dfs-cell" className="font-mono text-sm text-white">
        —
      </div>
    );
  }
  return (
    <div
      data-testid="dfs-cell"
      className={
        chips.length > 1
          ? "flex flex-col items-start gap-1"
          : "flex items-center gap-1"
      }
    >
      {chips.map((chip) => (
        <BookChip
          key={chip.book}
          book={chip.book}
          american={chip.american}
          url={chip.url}
        />
      ))}
    </div>
  );
}

function OddsCell({ row }: { row: ApiMlbPropBoardRow }) {
  const books = orderedBoardBooks(row.books).filter(
    (chip) => postedAmerican(chip.book, chip.american) != null,
  );
  const visible = books.slice(0, VISIBLE_ODDS_CHIPS);
  const overflow = books.slice(VISIBLE_ODDS_CHIPS);
  return (
    <div data-testid="odds-cell" className="flex flex-wrap items-center gap-3">
      {visible.map((chip) => (
        <BookChip
          key={chip.book}
          book={chip.book}
          american={chip.american}
          url={chip.url}
          line={chip.line}
        />
      ))}
      <OddsOverflow chips={overflow} />
    </div>
  );
}

function PlayerIcon({ row }: { row: ApiMlbPropBoardRow }) {
  const initial = (row.player_name.trim()[0] ?? "?").toUpperCase();
  const teamLogo = row.team_abbrev ? mlbTeamLogoUrl(row.team_abbrev) : null;
  return (
    <div
      data-testid="board-row-player-icon"
      className="flex shrink-0 items-end"
    >
      <div className="size-8 shrink-0">
        {row.headshot_url ? (
          <img
            src={row.headshot_url}
            alt=""
            className="size-8 rounded-full bg-white/10 object-cover"
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/50">
            {initial}
          </span>
        )}
      </div>
      {teamLogo ? (
        <div className="-mb-2 -ml-2 size-4 shrink-0">
          <img
            src={teamLogo}
            alt={row.team_abbrev ?? ""}
            title={row.team_abbrev ?? undefined}
            data-testid="board-row-team-logo"
            className="size-4 rounded-full bg-white/10 object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

function CompositeCell({ row }: { row: ApiMlbPropBoardRow }) {
  const matchup = formatMatchup(row);
  return (
    <div className="flex min-w-[14rem] items-center gap-2.5">
      <PlayerIcon row={row} />
      <div className="min-w-0 grow truncate">
        <div
          data-testid="board-row-headline"
          className="flex min-w-0 items-center gap-1.5"
        >
          <span
            data-testid="board-row-name"
            className="min-w-0 truncate font-bold text-white"
          >
            {row.player_name}
          </span>
          {matchup ? (
            <>
              <span
                className="size-0.5 shrink-0 rounded-full bg-white/25"
                aria-hidden
              />
              <span
                data-testid="board-row-matchup"
                className="shrink-0 text-[12px] font-medium text-white/50"
              >
                {matchup}
              </span>
            </>
          ) : null}
        </div>
        <p
          data-testid="board-row-market"
          className="truncate text-sm font-bold text-white"
        >
          {row.market_label}
        </p>
      </div>
    </div>
  );
}

function HitCell({
  testId,
  value,
  isLast = false,
}: {
  testId: string;
  value: number | null;
  isLast?: boolean;
}) {
  return (
    <td
      data-testid={testId}
      className={`border-y border-l px-2 py-2.5 text-center ${ROW_BOX_BORDER} ${
        isLast ? ROW_BOX_LAST : ""
      } ${hitBoxClass(value)}`}
    >
      <span className="text-[13px] font-semibold">
        {value == null ? "—" : `${value}%`}
      </span>
    </td>
  );
}

export function MlbPropPicksTable({
  rows,
  isLoading = false,
  isError = false,
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
          <table className="w-full min-w-[64rem] border-separate border-spacing-x-0 border-spacing-y-1.5 text-left">
            <thead className="sticky top-0">
              <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wide text-white/70">
                {COLUMNS.map((column) => {
                  const isHit =
                    column.sortable &&
                    HIT_SORT_KEYS.has(column.key as MlbPropBoardSortKey);
                  if (!column.sortable) {
                    return (
                      <th
                        key={column.key}
                        className="px-2 py-2 font-semibold"
                      >
                        {column.label}
                      </th>
                    );
                  }
                  const active = sort?.key === column.key;
                  const ariaSort = !active
                    ? "none"
                    : sort.direction === "asc"
                      ? "ascending"
                      : "descending";
                  return (
                    <th
                      key={column.key}
                      className={`px-2 py-2 font-semibold ${
                        isHit ? "text-center" : ""
                      }`}
                      aria-sort={ariaSort}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onSort(column.key as MlbPropBoardSortKey)
                        }
                        className={`bg-transparent p-0 uppercase tracking-wide text-white/70 hover:text-white ${
                          isHit ? "w-full text-center" : "text-left"
                        }`}
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
                  data-testid="board-row"
                  className="group"
                >
                  <td className={`px-2 py-2 ${ROW_BOX_FIRST}`}>
                    <CompositeCell row={row} />
                  </td>
                  <td
                    className={`px-2 py-2 font-mono text-sm text-white ${ROW_BOX_MIDDLE}`}
                    data-testid="line-cell"
                  >
                    {row.line}
                  </td>
                  <td className={`px-2 py-2 ${ROW_BOX_MIDDLE}`}>
                    <DfsCell row={row} />
                  </td>
                  <td className={`px-2 py-2 ${ROW_BOX_MIDDLE}`}>
                    <OddsCell row={row} />
                  </td>
                  <td
                    className={`px-2 py-2 font-mono text-sm text-white ${ROW_BOX_MIDDLE}`}
                    data-testid="ip-cell"
                  >
                    {row.ip_pct == null ? "—" : `${row.ip_pct}%`}
                  </td>
                  <HitCell testId="hit-l5-cell" value={row.hit_l5} />
                  <HitCell testId="hit-l10-cell" value={row.hit_l10} />
                  <HitCell testId="hit-l15-cell" value={row.hit_l15} />
                  <HitCell testId="hit-h2h-cell" value={row.hit_h2h} isLast />
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
