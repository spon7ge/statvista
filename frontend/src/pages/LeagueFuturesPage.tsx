import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { FuturesBoard } from "@/features/basketball/league/FuturesBoard";
import { WnbaFuturesHeader } from "@/features/basketball/league/WnbaFuturesHeader";
import { useWnbaFutures } from "@/features/basketball/hooks/useWnbaFutures";

export function LeagueFuturesPage() {
  const { data, isLoading, hasNeverLoaded } = useWnbaFutures();
  const season = data?.season ?? new Date().getFullYear();

  return (
    <div className="space-y-0">
      <LeagueSubnav league="wnba" />
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <WnbaFuturesHeader season={season} />
        <FuturesBoard
          markets={data?.markets ?? []}
          isLoading={isLoading && !data}
          isError={hasNeverLoaded}
        />
      </section>
    </div>
  );
}
