import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MLB_SOURCE_TIER_OPTIONS } from "./filterMlbPropPicks";

type FilterOption = { value: string; label: string };

type MultiSelectFilterProps = {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
};

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const triggerLabel =
    selected.size > 0 ? `${label} (${selected.size})` : label;

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
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
          selected.size > 0
            ? "border-white/20 bg-white/10 text-white"
            : "border-white/10 bg-transparent text-white/55 hover:text-white"
        }`}
      >
        {triggerLabel}
        <ChevronDown
          className="size-3 opacity-70"
          aria-hidden
          strokeWidth={1.75}
        />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="absolute top-full left-0 z-20 mt-1.5 max-h-56 min-w-[10rem] overflow-y-auto rounded-lg border border-white/10 bg-black py-0.5"
        >
          {options.length === 0 ? (
            <li className="px-2.5 py-1.5 text-[11px] text-white/40">
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
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-white/80 hover:bg-white/5"
                    onClick={() => toggle(opt.value)}
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                        checked
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

export type MlbPropPicksFiltersProps = {
  stats: string[];
  teams: string[];
  selectedStats: Set<string>;
  selectedTeams: Set<string>;
  selectedSides: Set<string>;
  selectedTiers: Set<string>;
  /** Fresh sharp vs stale DFS recency chip toggle (v1 spec: single optional filter). */
  freshVsStaleOnly: boolean;
  onStatsChange: (next: Set<string>) => void;
  onTeamsChange: (next: Set<string>) => void;
  onSidesChange: (next: Set<string>) => void;
  onTiersChange: (next: Set<string>) => void;
  onFreshVsStaleToggle: () => void;
  onClear: () => void;
};

export function MlbPropPicksFilters({
  stats,
  teams,
  selectedStats,
  selectedTeams,
  selectedSides,
  selectedTiers,
  freshVsStaleOnly,
  onStatsChange,
  onTeamsChange,
  onSidesChange,
  onTiersChange,
  onFreshVsStaleToggle,
  onClear,
}: MlbPropPicksFiltersProps) {
  const hasActive =
    selectedStats.size > 0 ||
    selectedTeams.size > 0 ||
    selectedSides.size > 0 ||
    selectedTiers.size > 0 ||
    freshVsStaleOnly;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="MLB prop picks filters"
    >
      <MultiSelectFilter
        label="Stat"
        options={stats.map((s) => ({ value: s, label: s }))}
        selected={selectedStats}
        onChange={onStatsChange}
      />
      <MultiSelectFilter
        label="Team"
        options={teams.map((t) => ({ value: t, label: t }))}
        selected={selectedTeams}
        onChange={onTeamsChange}
      />
      <MultiSelectFilter
        label="Side"
        options={[
          { value: "over", label: "Over" },
          { value: "under", label: "Under" },
        ]}
        selected={selectedSides}
        onChange={onSidesChange}
      />
      <MultiSelectFilter
        label="Tier"
        options={MLB_SOURCE_TIER_OPTIONS.map((t) => ({
          value: t.value,
          label: t.label,
        }))}
        selected={selectedTiers}
        onChange={onTiersChange}
      />
      <button
        type="button"
        aria-pressed={freshVsStaleOnly}
        onClick={onFreshVsStaleToggle}
        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
          freshVsStaleOnly
            ? "border-white/20 bg-white/10 text-white"
            : "border-white/10 bg-transparent text-white/55 hover:text-white"
        }`}
      >
        Fresh sharp vs stale DFS only
      </button>
      {hasActive ? (
        <button
          type="button"
          onClick={onClear}
          className="px-1.5 text-xs text-white/40 transition-colors hover:text-white"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
