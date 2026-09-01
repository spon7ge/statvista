import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchWnbaProps, type WnbaPropsParams } from "@/shared/lib/api";

/** Board lines move slowly; keep client cache aligned with the poll. */
export const WNBA_PROPS_STALE_MS = 15 * 60_000;

/** Default PrizePicks board (power / 4-pick) used by game-detail Props. */
export const WNBA_DEFAULT_PROPS: WnbaPropsParams = {
  app: "prizepicks",
  format: "power",
  legs: 4,
};

export function wnbaPropsQueryOptions(params: WnbaPropsParams) {
  return queryOptions({
    queryKey: ["wnba", "props", params.app, params.format, params.legs],
    queryFn: () => fetchWnbaProps(params),
    staleTime: WNBA_PROPS_STALE_MS,
    refetchInterval: WNBA_PROPS_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useWnbaProps(params: WnbaPropsParams) {
  return useQuery(wnbaPropsQueryOptions(params));
}

export function prefetchWnbaDefaultProps(client: QueryClient) {
  return client.prefetchQuery(wnbaPropsQueryOptions(WNBA_DEFAULT_PROPS));
}
