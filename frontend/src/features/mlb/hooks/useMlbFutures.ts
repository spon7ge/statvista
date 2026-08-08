import { useQuery } from "@tanstack/react-query";
import { fetchMlbFutures } from "@/shared/lib/api";

export function useMlbFutures() {
  const query = useQuery({
    queryKey: ["mlb", "futures"],
    queryFn: fetchMlbFutures,
  });

  return {
    ...query,
    hasNeverLoaded: query.isError && query.data === undefined,
  };
}
