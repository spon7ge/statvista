import { useMemo, useState } from "react";
import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { useMlbProps } from "@/features/mlb/hooks/useMlbProps";
import { MlbPropPicksFilters } from "@/features/mlb/league/MlbPropPicksFilters";
import { MlbPropPicksList } from "@/features/mlb/league/MlbPropPicksList";
import {
  collectMlbStatOptions,
  collectMlbTeamOptions,
  filterMlbPropPicks,
} from "@/features/mlb/league/filterMlbPropPicks";

/** v1 supports one DFS format per app (design doc: Flex/insurance are later). */
const APP_OPTIONS = [
  { value: "prizepicks", label: "PrizePicks", format: "power" },
  { value: "underdog", label: "Underdog", format: "standard" },
] as const;

const LEGS_OPTIONS = [2, 3, 4, 5, 6] as const;

function appLabel(app: string): string {
  return APP_OPTIONS.find((opt) => opt.value === app)?.label ?? app;
}

function formatForApp(app: string): string {
  return APP_OPTIONS.find((opt) => opt.value === app)?.format ?? "power";
}

export function MlbPropPicksPage() {
  const [app, setApp] = useState<string>(APP_OPTIONS[0].value);
  const [legs, setLegs] = useState<number>(4);
  const format = formatForApp(app);

  const { data, isLoading, isError, isFetched, dataUpdatedAt } = useMlbProps({
    app,
    format,
    legs,
  });

  const [selectedStats, setSelectedStats] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSides, setSelectedSides] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(
    () => new Set(),
  );
  const [freshVsStaleOnly, setFreshVsStaleOnly] = useState(false);

  const props = data?.props ?? [];
  const showLoading = isLoading && !isFetched;
  const showError = isError && !data;
  const apiEmpty = showError || Boolean(data && props.length === 0);

  const filtersActive =
    selectedStats.size > 0 ||
    selectedTeams.size > 0 ||
    selectedSides.size > 0 ||
    selectedTiers.size > 0 ||
    freshVsStaleOnly;

  const filtered = useMemo(
    () =>
      filterMlbPropPicks(props, {
        stats: selectedStats,
        teams: selectedTeams,
        sides: selectedSides,
        tiers: selectedTiers,
        freshVsStaleOnly,
      }),
    [props, selectedStats, selectedTeams, selectedSides, selectedTiers, freshVsStaleOnly],
  );

  function clearFilters() {
    setSelectedStats(new Set());
    setSelectedTeams(new Set());
    setSelectedSides(new Set());
    setSelectedTiers(new Set());
    setFreshVsStaleOnly(false);
  }

  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="mlb" />
      <section className="mx-auto max-w-6xl space-y-4 px-4 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          MLB Prop Picks
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-1 rounded-lg border border-white/10 p-1"
            role="group"
            aria-label="DFS app"
          >
            {APP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={app === opt.value}
                onClick={() => setApp(opt.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  app === opt.value
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div
            className="flex items-center gap-1 rounded-lg border border-white/10 p-1"
            role="group"
            aria-label="Legs"
          >
            {LEGS_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={legs === n}
                onClick={() => setLegs(n)}
                className={`size-6 rounded-md text-xs font-medium transition-colors ${
                  legs === n
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <span className="text-xs text-white/40">
            {legs}-pick {formatForApp(app)}
          </span>
        </div>

        {!showLoading && !apiEmpty && props.length > 0 ? (
          <MlbPropPicksFilters
            stats={collectMlbStatOptions(props)}
            teams={collectMlbTeamOptions(props)}
            selectedStats={selectedStats}
            selectedTeams={selectedTeams}
            selectedSides={selectedSides}
            selectedTiers={selectedTiers}
            freshVsStaleOnly={freshVsStaleOnly}
            onStatsChange={setSelectedStats}
            onTeamsChange={setSelectedTeams}
            onSidesChange={setSelectedSides}
            onTiersChange={setSelectedTiers}
            onFreshVsStaleToggle={() => setFreshVsStaleOnly((v) => !v)}
            onClear={clearFilters}
          />
        ) : null}

        <MlbPropPicksList
          props={filtered}
          format={format}
          legs={legs}
          breakevenPct={data?.breakeven_pct ?? null}
          isLoading={showLoading}
          isError={showError}
          filtersActive={filtersActive && !apiEmpty && props.length > 0}
          emptyMessage={
            apiEmpty && !showError
              ? `No ${appLabel(app)} board available.`
              : undefined
          }
          lastUpdatedAt={dataUpdatedAt || undefined}
        />
      </section>
    </div>
  );
}
