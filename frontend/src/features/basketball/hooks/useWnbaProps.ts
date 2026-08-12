import { useQuery } from "@tanstack/react-query";
import { fetchWnbaProps, type WnbaPropsParams } from "@/shared/lib/api";

const REFETCH_MS = 15 * 60_000;

export function useWnbaProps({ app, format, legs }: WnbaPropsParams) {
  return useQuery({
    queryKey: ["wnba", "props", app, format, legs],
    queryFn: () => fetchWnbaProps({ app, format, legs }),
    refetchInterval: REFETCH_MS,
  });
}
