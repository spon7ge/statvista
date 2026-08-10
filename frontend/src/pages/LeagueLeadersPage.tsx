import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { LeadersGrid } from "@/features/basketball/league/LeadersGrid";
import { WnbaLeadersHeader } from "@/features/basketball/league/WnbaLeadersHeader";
import { useWnbaLeaders } from "@/features/basketball/hooks/useWnbaLeaders";

export function LeagueLeadersPage() {
  const { data, isLoading, hasNeverLoaded } = useWnbaLeaders();
  const season = data?.season ?? new Date().getFullYear();

  return (
    <div className="space-y-0">
      <LeagueSubnav league="wnba" />
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <WnbaLeadersHeader season={season} />
        <LeadersGrid
          categories={data?.categories ?? []}
          isLoading={isLoading && !data}
          isError={hasNeverLoaded}
        />
      </section>
    </div>
  );
}
