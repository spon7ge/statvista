import { useQuery } from "@tanstack/react-query";
import { fetchMlbOdds } from "@/shared/lib/api";

const REFETCH_MS = 60_000;

export function useMlbOdds({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["mlb", "odds", "today"],
    queryFn: fetchMlbOdds,
    refetchInterval: REFETCH_MS,
    enabled,
  });
}
