import { useQuery } from "@tanstack/react-query";
import { fetchMlbGameDetail } from "@/lib/api";

export function useMlbGameDetail(gamePk: string | undefined) {
  const query = useQuery({
    queryKey: ["mlb", "game", gamePk],
    queryFn: () => fetchMlbGameDetail(gamePk!),
    enabled: Boolean(gamePk),
    refetchInterval: (q) => (q.state.data?.status === "live" ? 18_000 : false),
  });
  return {
    ...query,
    shouldPoll: query.data?.status === "live",
    hasNeverLoaded: query.isError && query.data === undefined,
  };
}
