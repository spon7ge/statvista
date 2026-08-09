import { useQuery } from "@tanstack/react-query";
import {
  fetchMlbGameProps,
  type MlbGamePropsParams,
} from "@/shared/lib/api";

const REFETCH_MS = 15 * 60_000;

export function useMlbGameProps({
  gamePk,
  app,
  enabled = true,
}: MlbGamePropsParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: ["mlb", "props", "game", gamePk, app],
    queryFn: () => fetchMlbGameProps({ gamePk, app }),
    enabled: Boolean(gamePk) && enabled,
    refetchInterval: REFETCH_MS,
  });
}
