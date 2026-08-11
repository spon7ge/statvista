import { useQuery } from "@tanstack/react-query";
import {
  fetchWnbaGameProps,
  type WnbaGamePropsParams,
} from "@/shared/lib/api";

const REFETCH_MS = 15 * 60_000;

export function useWnbaGameProps({
  espnEventId,
  app,
  enabled = true,
}: WnbaGamePropsParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: ["wnba", "props", "game", espnEventId, app],
    queryFn: () => fetchWnbaGameProps({ espnEventId, app }),
    enabled: Boolean(espnEventId) && enabled,
    refetchInterval: REFETCH_MS,
  });
}
