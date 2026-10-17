import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchNbaPropBoard } from "@/shared/lib/api";

/** Board lines move slowly; keep client cache aligned with the poll. */
export const NBA_PROP_BOARD_STALE_MS = 15 * 60_000;

export function nbaPropBoardQueryKey(book: string) {
  return ["nba", "props", "board", book] as const;
}

export function nbaPropBoardQueryOptions(book = "prizepicks") {
  return queryOptions({
    queryKey: nbaPropBoardQueryKey(book),
    queryFn: () => fetchNbaPropBoard(book),
    staleTime: NBA_PROP_BOARD_STALE_MS,
    refetchInterval: NBA_PROP_BOARD_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useNbaPropBoard(book = "prizepicks") {
  return useQuery(nbaPropBoardQueryOptions(book));
}

export function prefetchNbaPropBoard(client: QueryClient) {
  return client.prefetchQuery(nbaPropBoardQueryOptions("prizepicks"));
}
