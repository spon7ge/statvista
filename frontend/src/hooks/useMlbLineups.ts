import { useQuery } from "@tanstack/react-query";
import { fetchMlbLineups } from "@/shared/lib/api";

export function useMlbLineups(dateEt: string | null | undefined) {
  const query = useQuery({
    queryKey: ["mlb", "lineups", dateEt],
    queryFn: () => fetchMlbLineups(dateEt!),
    enabled: Boolean(dateEt),
  });
  return {
    ...query,
    hasNeverLoaded: query.isError && query.data === undefined,
  };
}
