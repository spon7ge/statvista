import { useQuery } from "@tanstack/react-query";
import { fetchNbaGameDetail } from "@/shared/lib/api";

export function useNbaGameDetail(espnEventId: string | undefined) {
  const query = useQuery({
    queryKey: ["nba", "game", espnEventId],
    queryFn: () => fetchNbaGameDetail(espnEventId!),
    enabled: Boolean(espnEventId),
    refetchInterval: (currentQuery) => {
      const status = currentQuery.state.data?.status;
      return status === "live" || status === "halftime" ? 18_000 : false;
    },
  });
  const status = query.data?.status;
  const shouldPoll = status === "live" || status === "halftime";

  return {
    ...query,
    shouldPoll,
    hasNeverLoaded: query.isError && query.data === undefined,
  };
}
