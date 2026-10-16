import { useQuery } from "@tanstack/react-query";
import { fetchNbaOdds } from "@/shared/lib/api";

const REFETCH_MS = 60_000;

export function useNbaOdds() {
  return useQuery({
    queryKey: ["nba", "odds", "today"],
    queryFn: fetchNbaOdds,
    refetchInterval: REFETCH_MS,
  });
}
