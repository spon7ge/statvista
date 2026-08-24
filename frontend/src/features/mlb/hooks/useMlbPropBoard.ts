import { useQuery } from "@tanstack/react-query";
import { fetchMlbPropBoard } from "@/shared/lib/api";

const REFETCH_MS = 15 * 60_000;

export function useMlbPropBoard() {
  return useQuery({
    queryKey: ["mlb", "props", "board"],
    queryFn: fetchMlbPropBoard,
    refetchInterval: REFETCH_MS,
  });
}
