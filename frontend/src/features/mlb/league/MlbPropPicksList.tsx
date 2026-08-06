import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ApiMlbPropBookQuote, ApiMlbPropRow } from "@/shared/lib/api";
import { TeamAbbrevAvatar } from "@/shared/ui/TeamAbbrevAvatar";

const SOURCE_TIER_LABELS: Record<string, string> = {
  sharp_consensus: "Sharp Consensus",
  sharp_disagreement: "Sharp Disagreement",
  sharp_single_source: "Sharp Single-Source",
  mid_tier_fallback: "Mid-Tier Fallback",
  no_sharp_read: "No Sharp Read",
};

const CHIP_LABELS: Record<string, string> = {
  dk_fd_agrees: "DK/FD agrees ↑",
  prophetx_only: "ProphetX only",
  novig_only: "Novig only",
  fresh_sharp_vs_stale_dfs: "Fresh sharp vs stale DFS",
  fresh_sharp: "Fresh sharp",
  stale_sharp: "Stale sharp",
};

const BOOK_LABELS: Record<string, string> = {
  prophetx: "ProphetX",
  novig: "Novig",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  pinnacle: "Pinnacle",
};

function chipLabel(chip: string): string {
  return CHIP_LABELS[chip] ?? chip.replace(/_/g, " ");
}

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
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      aria-label="Loading MLB prop picks"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
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
    <div className="flex flex-col items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center">
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

function PropPickCard({
  row,
  expanded,
  onToggle,
}: {
  row: ApiMlbPropRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isNoRead = row.source_tier === "no_sharp_read";
  const alt = altSideOf(row.recommended_side);
  const chips = [
    ...row.sample_chips,
    ...row.confidence_chips,
    ...(row.recency_chip ? [row.recency_chip] : []),
  ];
  const lean = sideLabel(row.recommended_side);

  return (
    <article
      data-testid="mlb-prop-row"
      className={`rounded-xl border bg-white/[0.03] p-4 transition-colors ${
        isNoRead
          ? "border-dashed border-white/10 opacity-60"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          {/* Matchup-style top header: status pill (green for now) + subtle meta */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[14px] font-semibold ${
                isNoRead
                  ? "bg-white/10 text-white/45"
                  : "bg-emerald-400 text-black"
              }`}
            >
              {isNoRead ? "No read" : lean}
            </span>
            <span className="truncate text-right text-[14px] text-white/40">
              {SOURCE_TIER_LABELS[row.source_tier] ?? row.source_tier}
            </span>
          </div>

          {/* Matchup TeamRow-style body: avatar · identity · edge-as-score */}
          <div className="flex items-center gap-2.5">
            {row.team_abbrev ? (
              <TeamAbbrevAvatar
                abbrev={row.team_abbrev}
                sizeClassName="size-8"
              />
            ) : (
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[14px] font-semibold text-white/45"
                aria-hidden
              >
                {(row.player_name.trim()[0] ?? "?").toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[18px] font-medium text-white">
                {row.player_name}
                <span className="font-normal text-white/55">
                  {" "}
                  - {row.stat} @ {row.line}
                </span>
              </span>
              {alt || chips.length > 0 ? (
                <span className="mt-0.5 block truncate text-[14px] text-white/40">
                  {alt ? (
                    <>
                      {sideLabel(alt)} {formatEdge(row.alt_edge_pct)}
                    </>
                  ) : null}
                  {alt && chips.length > 0 ? " · " : null}
                  {chips.map((chip) => chipLabel(chip)).join(" · ")}
                </span>
              ) : null}
            </span>
            <span
              className={`shrink-0 font-mono text-[18px] font-semibold tracking-tight ${
                isNoRead ? "text-white/30" : "text-white"
              }`}
            >
              {formatEdge(row.edge_pct)}
            </span>
          </div>

          <p className="mt-2 text-right text-[14px] text-white/35">
            fair {formatFair(row.fair_pct)}
          </p>
        </div>

        <ChevronDown
          className={`size-4 shrink-0 text-white/25 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
          strokeWidth={1.75}
        />
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
