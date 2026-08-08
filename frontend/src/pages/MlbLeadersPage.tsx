import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { MlbLeadersGrid } from "@/features/mlb/league/MlbLeadersGrid";
import { MlbLeadersHeader } from "@/features/mlb/league/MlbLeadersHeader";
import { useMlbLeaders } from "@/features/mlb/hooks/useMlbLeaders";

export function MlbLeadersPage() {
  const { data, isLoading, hasNeverLoaded } = useMlbLeaders();
  const season = data?.season ?? new Date().getFullYear();

  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="mlb" />
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <MlbLeadersHeader season={season} />
        <MlbLeadersGrid
          categories={data?.categories ?? []}
          isLoading={isLoading && !data}
          isError={hasNeverLoaded}
        />
      </section>
    </div>
  );
}
