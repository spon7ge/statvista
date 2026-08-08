import { useState } from "react";
import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { MlbFuturesBoard } from "@/features/mlb/league/MlbFuturesBoard";
import { MlbFuturesHeader } from "@/features/mlb/league/MlbFuturesHeader";
import type { FuturesGroupId } from "@/features/mlb/league/mlbFuturesGroups";
import { useMlbFutures } from "@/features/mlb/hooks/useMlbFutures";

export function MlbFuturesPage() {
  const { data, isLoading, hasNeverLoaded } = useMlbFutures();
  const [group, setGroup] = useState<FuturesGroupId>("world_series");
  const season = data?.season ?? new Date().getFullYear();

  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="mlb" />
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <MlbFuturesHeader season={season} />
        <MlbFuturesBoard
          markets={data?.markets ?? []}
          group={group}
          onGroupChange={setGroup}
          isLoading={isLoading && !data}
          isError={hasNeverLoaded}
        />
      </section>
    </div>
  );
}
