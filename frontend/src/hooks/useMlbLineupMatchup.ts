import { useQuery } from "@tanstack/react-query";
import { fetchMlbLineupMatchup } from "@/shared/lib/api";

export function useMlbLineupMatchup(args: {
  dateEt: string | null | undefined;
  away: string | null | undefined;
  home: string | null | undefined;
  enabled?: boolean;
}) {
  const { dateEt, away, home, enabled = true } = args;
  return useQuery({
    queryKey: ["mlb", "lineups", "matchup", dateEt, away, home],
    queryFn: () => fetchMlbLineupMatchup(dateEt!, away!, home!),
    enabled: Boolean(enabled && dateEt && away && home),
  });
}
