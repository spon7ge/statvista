import { useQuery } from "@tanstack/react-query";
import { fetchMlbProps, type MlbPropsParams } from "@/shared/lib/api";

const REFETCH_MS = 60_000;

export function useMlbProps({ app, format, legs }: MlbPropsParams) {
  return useQuery({
    queryKey: ["mlb", "props", app, format, legs],
    queryFn: () => fetchMlbProps({ app, format, legs }),
    refetchInterval: REFETCH_MS,
  });
}
