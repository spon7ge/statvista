import { useState } from "react";
import type { ApiMlbPropBookQuote, ApiMlbPropRow } from "@/shared/lib/api";

const BOOK_LABELS: Record<string, string> = {
  prophetx: "ProphetX",
  novig: "Novig",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  pinnacle: "Pinnacle",
};

function sideLabel(side: string | null): string {
  if (side === "over") return "Over";
  if (side === "under") return "Under";
  return "—";
}

function altSideOf(side: string | null): string | null {
  if (side === "over") return "under";
  if (side === "under") return "over";
  return null;
}

function formatEdge(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function edgeToneClass(value: number | null): string {
  if (value === null) return "text-white/35";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-white/70";
}

function formatFair(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`.replace("-", "−");
}

function formatFormatLabel(format: string): string {
  if (format.length === 0) return format;
  return format.charAt(0).toUpperCase() + format.slice(1);
}

function formatAge(changedAt: string | null): string {
  if (!changedAt) return "—";
  const changedMs = Date.parse(changedAt);
  if (Number.isNaN(changedMs)) return "—";
  const diffMin = Math.max(0, Math.round((Date.now() - changedMs) / 60_000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.round(diffMin / 60)}h ago`;
}

export function formatMlbPropPicksUpdatedAt(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function rowKey(row: ApiMlbPropRow): string {
  return `${row.player_name}:${row.stat}:${row.line}:${row.recommended_side ?? ""}`;
}

function Skeletons() {
  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading MLB prop picks"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl bg-[#3a3d42]"
        />
      ))}
    </div>
  );
}

function BookQuoteCell({
  bookKey,
  quote,
}: {
  bookKey: string;
  quote: ApiMlbPropBookQuote | null;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md bg-[#45484d] px-2 py-1.5 text-center">
      <span className="text-[14px] font-medium tracking-wide text-white/45 uppercase">
        {BOOK_LABELS[bookKey] ?? bookKey}
        {quote?.role === "comparison" ? (
          <span className="ml-1 text-white/30">(cmp)</span>
        ) : null}
      </span>
      {quote ? (
        <>
          <span className="font-mono text-[18px] text-white/90">
            {sideLabel(quote.side)}{" "}
            {quote.fair_pct !== null ? formatFair(quote.fair_pct) : "—"}
          </span>
          <span className="text-[14px] text-white/40">
            {quote.american !== null ? formatAmericanOdds(quote.american) : "—"}
            {" · "}
            {formatAge(quote.changed_at)}
          </span>
        </>
      ) : (
        <span className="text-[14px] text-white/20">No line</span>
      )}
    </div>
  );
}

function ExpandedPanel({ row }: { row: ApiMlbPropRow }) {
  const alt = altSideOf(row.recommended_side);
  return (
    <div
      data-testid="mlb-prop-row-expand"
      className="mt-3 space-y-3 border-t border-white/10 pt-3 text-[18px]"
    >
      <p className="text-[14px] text-white/70">{row.fair_explain}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <BookQuoteCell bookKey="prophetx" quote={row.books.prophetx} />
        <BookQuoteCell bookKey="novig" quote={row.books.novig} />
        <BookQuoteCell bookKey="draftkings" quote={row.books.draftkings} />
        <BookQuoteCell bookKey="fanduel" quote={row.books.fanduel} />
        <BookQuoteCell bookKey="pinnacle" quote={row.books.pinnacle} />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[14px] text-white/50">
        <span>
          {sideLabel(row.recommended_side)} edge {formatEdge(row.edge_pct)}
        </span>
        {alt ? (
          <span>
            {sideLabel(alt)} edge {formatEdge(row.alt_edge_pct)}
          </span>
        ) : null}
        <span>DFS line updated {formatAge(row.dfs.changed_at)}</span>
      </div>
    </div>
  );
}

function teamPosLabel(team: string | null, pos: string | null): string | null {
  const parts = [team, pos].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function PropPickCard({
  row,
  expanded,
  onToggle,
}: {
  row: ApiMlbPropRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const isNoRead = row.source_tier === "no_sharp_read";
  const lean = sideLabel(row.recommended_side);
  const meta = teamPosLabel(row.team_abbrev, row.position);
  const showImg = Boolean(row.headshot_url) && !imgFailed;
  const initial = (row.player_name.trim()[0] ?? "?").toUpperCase();

  return (
    <article
      data-testid="mlb-prop-row"
      className={`rounded-xl bg-[#3a3d42] p-4 transition-colors ${
        isNoRead ? "opacity-60" : "hover:bg-[#45484d]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left"
      >
        <div className="flex flex-col items-center text-center">
          {showImg ? (
            <img
              src={row.headshot_url!}
              alt={row.player_name}
              className="size-16 rounded-full object-cover bg-white/10"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span
              data-testid="mlb-prop-headshot-fallback"
              className="flex size-16 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white/50"
            >
              {initial}
            </span>
          )}
          {meta ? (
            <p className="mt-2 text-[14px] text-white/45">{meta}</p>
          ) : null}
          <p className="mt-1 text-[18px] font-semibold text-white">
            {row.player_name}
          </p>
          <p className="mt-1 text-[18px] text-white">
            {row.line} {row.stat}
          </p>
          <div className="mt-3 flex w-full items-center justify-between gap-2">
            <span className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-[14px] font-semibold text-black">
              {lean}
            </span>
            <span
              className={`font-mono text-[18px] font-semibold ${edgeToneClass(row.edge_pct)}`}
            >
              {formatEdge(row.edge_pct)}
            </span>
          </div>
        </div>
      </button>

      {expanded ? <ExpandedPanel row={row} /> : null}
    </article>
  );
}

export type MlbPropPicksListProps = {
  props: ApiMlbPropRow[];
  format: string;
  legs: number;
  breakevenPct: number | null;
  isLoading?: boolean;
  isError?: boolean;
  /** True when filters hid all rows (API still returned props). */
  filtersActive?: boolean;
  /** Override default empty/error copy when set (e.g. missing app snapshot). */
  emptyMessage?: string;
  /** Epoch ms of last successful props API fetch (React Query dataUpdatedAt). */
  lastUpdatedAt?: number;
};

export function MlbPropPicksList({
  props,
  format,
  legs,
  breakevenPct,
  isLoading = false,
  isError = false,
  filtersActive = false,
  emptyMessage,
  lastUpdatedAt,
}: MlbPropPicksListProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(),
  );

  function toggleRow(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const emptyCopy =
    emptyMessage ??
    (filtersActive && !isError
      ? "No props match these filters"
      : "Prop lines unavailable");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] text-white/45">
          {breakevenPct !== null
            ? `Breakeven for ${legs}-pick ${formatFormatLabel(format)}: ${formatFair(breakevenPct)}`
            : null}
        </p>
        {lastUpdatedAt ? (
          <p className="text-[14px] text-white/40">
            Last updated {formatMlbPropPicksUpdatedAt(lastUpdatedAt)}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <Skeletons />
      ) : isError || props.length === 0 ? (
        <p className="px-1 text-[14px] text-white/40">{emptyCopy}</p>
      ) : (
        <div
          data-testid="mlb-prop-picks-grid"
          className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
        >
          {props.map((row) => {
            const key = rowKey(row);
            return (
              <PropPickCard
                key={key}
                row={row}
                expanded={expandedKeys.has(key)}
                onToggle={() => toggleRow(key)}
              />
            );
          })}
        </div>
      )}

      {!isLoading && props.length > 0 ? (
        <p className="px-1 text-[14px] text-white/35">
          Fair from ProphetX/Novig (then DK/FD). DFS lines from
          PrizePicks/Underdog. Pinnacle comparison only.
        </p>
      ) : null}
    </section>
  );
}
