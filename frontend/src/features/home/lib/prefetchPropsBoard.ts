import type { QueryClient } from "@tanstack/react-query";
import { prefetchWnbaDefaultProps } from "@/features/basketball/hooks/useWnbaProps";
import { prefetchMlbPropBoard } from "@/features/mlb/hooks/useMlbPropBoard";

/** Warm the board that `href` opens so a Props click can reuse the cache. */
export function prefetchPropsBoard(client: QueryClient, href: string): void {
  if (href.startsWith("/mlb/prop_picks")) {
    void prefetchMlbPropBoard(client);
    return;
  }
  if (href.startsWith("/wnba/prop_picks")) {
    void prefetchWnbaDefaultProps(client);
  }
}
