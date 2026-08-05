import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { LeadersGrid } from "@/features/basketball/league/LeadersGrid";
import { useWnbaLeaders } from "@/features/basketball/hooks/useWnbaLeaders";

export function LeagueLeadersPage() {
  const { data, isLoading, hasNeverLoaded } = useWnbaLeaders();
  const season = data?.season ?? new Date().getFullYear();

  return (
    <div className="space-y-0">
      <LeagueSubnav league="wnba" />
      <LeadersGrid
        season={season}
        categories={data?.categories ?? []}
        isLoading={isLoading && !data}
        isError={hasNeverLoaded}
      />
    </div>
  );
}
