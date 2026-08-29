import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchMlbPropBoard } from "@/shared/lib/api";

/** Board lines move slowly; keep client cache aligned with the poll. */
export const MLB_PROP_BOARD_STALE_MS = 15 * 60_000;

export const MLB_PROP_BOARD_QUERY_KEY = ["mlb", "props", "board"] as const;

export function mlbPropBoardQueryOptions() {
  return queryOptions({
    queryKey: MLB_PROP_BOARD_QUERY_KEY,
    queryFn: fetchMlbPropBoard,
    staleTime: MLB_PROP_BOARD_STALE_MS,
    refetchInterval: MLB_PROP_BOARD_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useMlbPropBoard() {
  return useQuery(mlbPropBoardQueryOptions());
}

export function prefetchMlbPropBoard(client: QueryClient) {
  return client.prefetchQuery(mlbPropBoardQueryOptions());
}
