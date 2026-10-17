import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchWnbaPropBoard } from "@/shared/lib/api";

/** Board lines move slowly; keep client cache aligned with the poll. */
export const WNBA_PROP_BOARD_STALE_MS = 15 * 60_000;

export function wnbaPropBoardQueryKey(book: string) {
  return ["wnba", "props", "board", book] as const;
}

export function wnbaPropBoardQueryOptions(book = "prizepicks") {
  return queryOptions({
    queryKey: wnbaPropBoardQueryKey(book),
    queryFn: () => fetchWnbaPropBoard(book),
    staleTime: WNBA_PROP_BOARD_STALE_MS,
    refetchInterval: WNBA_PROP_BOARD_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useWnbaPropBoard(book = "prizepicks") {
  return useQuery(wnbaPropBoardQueryOptions(book));
}

export function prefetchWnbaPropBoard(client: QueryClient) {
  return client.prefetchQuery(wnbaPropBoardQueryOptions("prizepicks"));
}
