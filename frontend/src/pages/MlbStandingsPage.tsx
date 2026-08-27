import { useState } from "react";
import { MlbStandingsGrid } from "@/features/mlb/league/MlbStandingsGrid";
import {
  MlbStandingsHeader,
  type MlbStandingsView,
} from "@/features/mlb/league/MlbStandingsHeader";
import { useMlbStandings } from "@/features/mlb/hooks/useMlbStandings";

export function MlbStandingsPage() {
  const { data, isLoading, hasNeverLoaded } = useMlbStandings();
  const season = data?.season ?? new Date().getFullYear();
  const [view, setView] = useState<MlbStandingsView>("division");

  return (
    <div className="space-y-0 pb-8">
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <MlbStandingsHeader
          season={season}
          view={view}
          onViewChange={setView}
        />
        <MlbStandingsGrid
          leagues={data?.leagues ?? []}
          view={view}
          isLoading={isLoading && !data}
          isError={hasNeverLoaded}
        />
      </section>
    </div>
  );
}
