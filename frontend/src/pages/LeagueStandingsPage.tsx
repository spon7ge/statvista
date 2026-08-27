import { StandingsGrid } from "@/features/basketball/league/StandingsGrid";
import { WnbaStandingsHeader } from "@/features/basketball/league/WnbaStandingsHeader";
import { useWnbaStandings } from "@/features/basketball/hooks/useWnbaStandings";

export function LeagueStandingsPage() {
  const { data, isLoading, hasNeverLoaded } = useWnbaStandings();
  const season = data?.season ?? new Date().getFullYear();

  return (
    <div className="space-y-0">
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <WnbaStandingsHeader season={season} />
        <StandingsGrid
          conferences={data?.conferences ?? []}
          isLoading={isLoading && !data}
          isError={hasNeverLoaded}
        />
      </section>
    </div>
  );
}
