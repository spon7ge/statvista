import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { FuturesBoard } from "@/features/basketball/league/FuturesBoard";
import { useWnbaFutures } from "@/features/basketball/hooks/useWnbaFutures";

export function LeagueFuturesPage() {
  const { data, isLoading, hasNeverLoaded } = useWnbaFutures();

  return (
    <div className="space-y-0">
      <LeagueSubnav league="wnba" />
      <FuturesBoard
        season={data?.season ?? new Date().getFullYear()}
        markets={data?.markets ?? []}
        isLoading={isLoading && !data}
        isError={hasNeverLoaded}
      />
    </div>
  );
}
