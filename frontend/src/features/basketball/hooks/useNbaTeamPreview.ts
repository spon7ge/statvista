import { useQuery } from "@tanstack/react-query";
import {
  fetchNbaTeamPreview,
  type NbaTeamPreviewParams,
} from "@/shared/lib/api";

const REFETCH_MS = 15 * 60_000;

export function useNbaTeamPreview({
  espnEventId,
  side,
  enabled = true,
}: NbaTeamPreviewParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: ["nba", "team-preview", espnEventId, side],
    queryFn: () => fetchNbaTeamPreview({ espnEventId, side }),
    enabled: Boolean(espnEventId) && enabled,
    refetchInterval: REFETCH_MS,
  });
}
