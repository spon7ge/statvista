import { useQuery } from "@tanstack/react-query";
import {
  fetchMlbTeamPreview,
  type MlbTeamPreviewParams,
} from "@/shared/lib/api";

const REFETCH_MS = 15 * 60_000;

export function useMlbTeamPreview({
  gamePk,
  side,
  enabled = true,
}: MlbTeamPreviewParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: ["mlb", "team-preview", gamePk, side],
    queryFn: () => fetchMlbTeamPreview({ gamePk, side }),
    enabled: Boolean(gamePk) && enabled,
    refetchInterval: REFETCH_MS,
  });
}
