import { useQuery } from "@tanstack/react-query";
import { fetchMlbStandings } from "@/shared/lib/api";

export function useMlbStandings() {
  const query = useQuery({
    queryKey: ["mlb", "standings"],
    queryFn: fetchMlbStandings,
  });

  return {
    ...query,
    hasNeverLoaded: query.isError && query.data === undefined,
  };
}
