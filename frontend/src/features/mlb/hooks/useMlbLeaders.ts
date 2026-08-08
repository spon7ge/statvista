import { useQuery } from "@tanstack/react-query";
import { fetchMlbLeaders } from "@/shared/lib/api";

export function useMlbLeaders() {
  const query = useQuery({
    queryKey: ["mlb", "leaders"],
    queryFn: fetchMlbLeaders,
  });

  return {
    ...query,
    hasNeverLoaded: query.isError && query.data === undefined,
  };
}
