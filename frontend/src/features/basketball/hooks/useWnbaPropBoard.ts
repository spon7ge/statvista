import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchWnbaPropBoard } from "@/shared/lib/api";

/** Board lines move slowly; keep client cache aligned with the poll. */
export const WNBA_PROP_BOARD_STALE_MS = 15 * 60_000;

export const WNBA_PROP_BOARD_QUERY_KEY = ["wnba", "props", "board"] as const;

export function wnbaPropBoardQueryOptions() {
  return queryOptions({
    queryKey: WNBA_PROP_BOARD_QUERY_KEY,
    queryFn: fetchWnbaPropBoard,
    staleTime: WNBA_PROP_BOARD_STALE_MS,
    refetchInterval: WNBA_PROP_BOARD_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useWnbaPropBoard() {
  return useQuery(wnbaPropBoardQueryOptions());
}

export function prefetchWnbaPropBoard(client: QueryClient) {
  return client.prefetchQuery(wnbaPropBoardQueryOptions());
}
