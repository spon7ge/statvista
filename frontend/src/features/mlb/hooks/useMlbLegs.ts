import { useQuery } from "@tanstack/react-query";
import { fetchMlbLegs, type MlbLegsParams } from "@/shared/lib/api";

/** Matches the server in-process cache; freshness is the product. */
const STALE_MS = 5 * 60 * 1000;

export function useMlbLegs({ app, format, legs }: MlbLegsParams) {
  return useQuery({
    queryKey: ["mlb", "legs", app, format, legs],
    queryFn: () => fetchMlbLegs({ app, format, legs }),
    staleTime: STALE_MS,
  });
}
