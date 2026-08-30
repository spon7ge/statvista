import { useQuery } from "@tanstack/react-query";
import { fetchWnbaLegs, type LegsParams } from "@/shared/lib/api";

const STALE_MS = 5 * 60 * 1000;

export function useWnbaLegs({ app, format, legs }: LegsParams) {
  return useQuery({
    queryKey: ["wnba", "legs", app, format, legs],
    queryFn: () => fetchWnbaLegs({ app, format, legs }),
    staleTime: STALE_MS,
  });
}
