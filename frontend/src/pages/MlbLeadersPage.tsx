import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { MlbLeadersGrid } from "@/features/mlb/league/MlbLeadersGrid";
import { useMlbLeaders } from "@/features/mlb/hooks/useMlbLeaders";

export function MlbLeadersPage() {
  const { data, isLoading, hasNeverLoaded } = useMlbLeaders();
  const season = data?.season ?? new Date().getFullYear();

  return (
    <div className="space-y-0">
      <LeagueSubnav league="mlb" />
      <MlbLeadersGrid
        season={season}
        categories={data?.categories ?? []}
        isLoading={isLoading && !data}
        isError={hasNeverLoaded}
      />
    </div>
  );
}
