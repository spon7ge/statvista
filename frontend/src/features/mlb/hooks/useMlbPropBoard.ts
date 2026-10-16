import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchMlbPropBoard } from "@/shared/lib/api";

/** Board lines move slowly; keep client cache aligned with the poll. */
export const MLB_PROP_BOARD_STALE_MS = 15 * 60_000;

export function mlbPropBoardQueryKey(book: string) {
  return ["mlb", "props", "board", book] as const;
}

export function mlbPropBoardQueryOptions(book = "prizepicks") {
  return queryOptions({
    queryKey: mlbPropBoardQueryKey(book),
    queryFn: () => fetchMlbPropBoard(book),
    staleTime: MLB_PROP_BOARD_STALE_MS,
    refetchInterval: MLB_PROP_BOARD_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useMlbPropBoard(book = "prizepicks") {
  return useQuery(mlbPropBoardQueryOptions(book));
}

export function prefetchMlbPropBoard(client: QueryClient) {
  return client.prefetchQuery(mlbPropBoardQueryOptions("prizepicks"));
}
