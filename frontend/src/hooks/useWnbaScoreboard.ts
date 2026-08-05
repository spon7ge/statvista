import { useQuery } from "@tanstack/react-query";
import { slateEtDate } from "@/shared/lib/matchupSlateDate";
import { fetchWnbaScoreboard, fetchWnbaScoreboardByDate } from "@/shared/lib/api";
import {
  mapToLiveGames,
  mapToTickerGames,
  shouldPollScoreboard,
} from "@/shared/lib/mapScoreboard";

const REFETCH_MS = 18_000;

export function useWnbaScoreboard(dateEt?: string) {
  const today = slateEtDate();
  const selected = dateEt ?? today;
  const isToday = selected === today;

  const query = useQuery({
    queryKey: isToday
      ? ["wnba", "scoreboard", "today"]
      : ["wnba", "scoreboard", selected],
    queryFn: () =>
      isToday ? fetchWnbaScoreboard() : fetchWnbaScoreboardByDate(selected),
    refetchInterval: (q) =>
      isToday && shouldPollScoreboard(q.state.data?.games)
        ? REFETCH_MS
        : false,
  });

  const games = query.data?.games ?? [];
  return {
    ...query,
    games,
    tickerGames: mapToTickerGames(games),
    liveGames: mapToLiveGames(games),
    shouldPoll: isToday && shouldPollScoreboard(query.data?.games),
    // Errors after a successful load keep showing the last good scoreboard, so
    // only a never-loaded query surfaces an error state to the UI.
    hasNeverLoaded: query.isError && query.data === undefined,
  };
}
