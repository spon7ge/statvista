import { useQuery } from "@tanstack/react-query";
import { fetchWnbaStandings } from "@/shared/lib/api";

export function useWnbaStandings() {
  const query = useQuery({
    queryKey: ["wnba", "standings"],
    queryFn: fetchWnbaStandings,
  });

  return {
    ...query,
    hasNeverLoaded: query.isError && query.data === undefined,
  };
}
