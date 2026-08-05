import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { StandingsGrid } from "@/features/basketball/league/StandingsGrid";
import { useWnbaStandings } from "@/features/basketball/hooks/useWnbaStandings";

export function LeagueStandingsPage() {
  const { data, isLoading, hasNeverLoaded } = useWnbaStandings();
  const season = data?.season ?? new Date().getFullYear();

  return (
    <div className="space-y-0">
      <LeagueSubnav league="wnba" />
      <StandingsGrid
        season={season}
        conferences={data?.conferences ?? []}
        isLoading={isLoading && !data}
        isError={hasNeverLoaded}
      />
    </div>
  );
}
