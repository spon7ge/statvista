import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MlbHitRateWindow, MlbPropositionOption } from "./filterMlbPropBoard";

type FilterOption = { value: string; label: string };
type FilterTone = "default" | "banner" | "pill";

type MultiSelectFilterProps = {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  tone?: FilterTone;
  /** One value at a time; click again to clear. */
  single?: boolean;
};

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  tone = "default",
  single = false,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedOption = single
    ? options.find((opt) => selected.has(opt.value))
    : undefined;
  const triggerLabel = selectedOption
    ? `${label} (${selectedOption.label})`
    : selected.size > 0
      ? `${label} (${selected.size})`
      : label;
  const onBanner = tone === "banner";
  const onPill = tone === "pill";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(value: string) {
    if (single) {
      onChange(selected.has(value) ? new Set() : new Set([value]));
      setOpen(false);
      return;
    }
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={
          onBanner
            ? `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold shadow-sm ${
                selected.size > 0
                  ? "bg-white text-emerald-900"
                  : "bg-white/90 text-emerald-800 hover:bg-white"
              }`
            : onPill
              ? `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[14px] font-semibold transition-colors ${
                  selected.size > 0
                    ? "border-white/25 bg-white/15 text-white"
                    : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-white"
                }`
              : `inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[18px] font-medium transition-colors ${
                  selected.size > 0
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-transparent text-white/55 hover:text-white"
                }`
        }
      >
        {triggerLabel}
        <ChevronDown
          className="size-3.5 opacity-70"
          aria-hidden
          strokeWidth={1.75}
        />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          aria-multiselectable={!single}
          className={
            onBanner
              ? "absolute top-full left-0 z-50 mt-1.5 max-h-56 min-w-[10rem] overflow-y-auto rounded-xl border border-black/10 bg-white py-1 shadow-lg"
              : "absolute top-full left-0 z-20 mt-1.5 max-h-56 min-w-[10rem] overflow-y-auto rounded-lg border border-white/10 bg-black py-0.5"
          }
        >
          {options.length === 0 ? (
            <li
              className={`px-2.5 py-1.5 text-[14px] ${
                onBanner ? "text-zinc-400" : "text-white/40"
              }`}
            >
              No options
            </li>
          ) : (
            options.map((opt) => {
              const checked = selected.has(opt.value);
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    className={
                      onBanner
                        ? `flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[14px] ${
                            checked
                              ? "bg-emerald-50 text-emerald-900"
                              : "text-zinc-800 hover:bg-zinc-50"
                          }`
                        : "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[18px] text-white/80 hover:bg-white/5"
                    }
                    onClick={() => toggle(opt.value)}
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border text-[14px] ${
                        onBanner
                          ? checked
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-zinc-300 bg-transparent text-transparent"
                          : checked
                            ? "border-white/40 bg-white/15 text-white"
                            : "border-white/20 bg-transparent text-transparent"
                      }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span>{opt.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

const SIDE_OPTIONS: FilterOption[] = [
  { value: "over", label: "Over" },
  { value: "under", label: "Under" },
];

const HIT_RATE_OPTIONS: FilterOption[] = [
  { value: "l5", label: "L5" },
  { value: "l10", label: "L10" },
  { value: "l15", label: "L15" },
];

export type MlbPropPicksFiltersProps = {
  teams: string[];
  selectedTeams: Set<string>;
  query: string;
  onTeamsChange: (next: Set<string>) => void;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  markets?: MlbPropositionOption[];
  selectedMarkets?: Set<string>;
  onMarketsChange?: (next: Set<string>) => void;
  selectedSides?: Set<string>;
  onSidesChange?: (next: Set<string>) => void;
  books?: MlbPropositionOption[];
  selectedBooks?: Set<string>;
  onBooksChange?: (next: Set<string>) => void;
  games?: MlbPropositionOption[];
  selectedGames?: Set<string>;
  onGamesChange?: (next: Set<string>) => void;
  hitRate?: MlbHitRateWindow | null;
  onHitRateChange?: (next: MlbHitRateWindow | null) => void;
  /** `banner` = white pills on green; `pill` = dark-page capsules; default = square. */
  tone?: FilterTone;
  /** Team (+ clear) on the left, search on the right. */
  layout?: "inline" | "split";
};

export function MlbPropPicksFilters({
  teams,
  selectedTeams,
  query,
  onTeamsChange,
  onQueryChange,
  onClear,
  markets = [],
  selectedMarkets = new Set(),
  onMarketsChange,
  selectedSides = new Set(),
  onSidesChange,
  books = [],
  selectedBooks = new Set(),
  onBooksChange,
  games = [],
  selectedGames = new Set(),
  onGamesChange,
  hitRate = null,
  onHitRateChange,
  tone = "default",
  layout = "inline",
}: MlbPropPicksFiltersProps) {
  const hasActive =
    selectedTeams.size > 0 ||
    query.trim().length > 0 ||
    selectedMarkets.size > 0 ||
    selectedSides.size > 0 ||
    selectedBooks.size > 0 ||
    selectedGames.size > 0 ||
    hitRate != null;
  const onBanner = tone === "banner";
  const onPill = tone === "pill";
  const split = layout === "split";

  const gameControl =
    games.length > 0 ? (
      <MultiSelectFilter
        label="Game"
        tone={tone}
        options={games}
        selected={selectedGames}
        onChange={onGamesChange ?? (() => {})}
      />
    ) : null;

  const teamControl =
    teams.length > 0 ? (
      <MultiSelectFilter
        label="Team"
        tone={tone}
        options={teams.map((t) => ({ value: t, label: t }))}
        selected={selectedTeams}
        onChange={onTeamsChange}
      />
    ) : null;

  const bookmakerControl =
    books.length > 0 ? (
      <MultiSelectFilter
        label="Bookmaker"
        tone={tone}
        options={books}
        selected={selectedBooks}
        onChange={onBooksChange ?? (() => {})}
      />
    ) : null;

  const propositionControl =
    markets.length > 0 ? (
      <MultiSelectFilter
        label="Proposition"
        tone={tone}
        options={markets}
        selected={selectedMarkets}
        onChange={onMarketsChange ?? (() => {})}
      />
    ) : null;

  const sideControl = (
    <MultiSelectFilter
      label="Over/Under"
      tone={tone}
      options={SIDE_OPTIONS}
      selected={selectedSides}
      onChange={onSidesChange ?? (() => {})}
    />
  );

  const hitRateControl = (
    <MultiSelectFilter
      label="Hit rate"
      tone={tone}
      single
      options={HIT_RATE_OPTIONS}
      selected={hitRate ? new Set([hitRate]) : new Set()}
      onChange={(next) => {
        const value = [...next][0];
        onHitRateChange?.(
          value === "l5" || value === "l10" || value === "l15" ? value : null,
        );
      }}
    />
  );

  const extraFilters = (
    <>
      {bookmakerControl}
      {propositionControl}
      {sideControl}
      {hitRateControl}
    </>
  );

  const clearControl = hasActive ? (
    <button
      type="button"
      onClick={onClear}
      className={
        onBanner
          ? "rounded-full bg-white/20 px-3 py-1.5 text-[14px] font-semibold text-white hover:bg-white/30"
          : onPill
            ? "rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[14px] font-semibold text-white/80 hover:bg-white/15 hover:text-white"
            : "px-1.5 text-[14px] text-white/40 transition-colors hover:text-white"
      }
    >
      Clear filters
    </button>
  ) : null;

  const searchControl = (
    <input
      type="search"
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      placeholder="Search player"
      aria-label="Search player"
      className={
        onBanner
          ? "w-40 rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-emerald-900 shadow-sm placeholder:font-medium placeholder:text-emerald-800/50"
          : onPill
            ? "w-40 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[14px] font-semibold text-white placeholder:font-medium placeholder:text-white/40"
            : "w-40 rounded-md border border-white/10 bg-transparent px-2.5 py-1.5 text-[18px] text-white placeholder:text-white/40"
      }
    />
  );

  if (split) {
    return (
      <div
        className="flex w-full items-center justify-between gap-3"
        aria-label="MLB prop picks filters"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {gameControl}
          {teamControl}
          {extraFilters}
          {clearControl}
        </div>
        <div className="shrink-0">{searchControl}</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="MLB prop picks filters"
    >
      {gameControl}
      {teamControl}
      {extraFilters}
      {searchControl}
      {clearControl}
    </div>
  );
}
