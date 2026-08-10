import { useQuery } from "@tanstack/react-query";
import {
  fetchWnbaTeamPreview,
  type WnbaTeamPreviewParams,
} from "@/shared/lib/api";

const REFETCH_MS = 15 * 60_000;

export function useWnbaTeamPreview({
  espnEventId,
  side,
  enabled = true,
}: WnbaTeamPreviewParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: ["wnba", "team-preview", espnEventId, side],
    queryFn: () => fetchWnbaTeamPreview({ espnEventId, side }),
    enabled: Boolean(espnEventId) && enabled,
    refetchInterval: REFETCH_MS,
  });
}
