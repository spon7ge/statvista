import { Outlet } from "react-router-dom";
import { HomeNav } from "@/features/home/HomeNav";
import { LiveTicker } from "@/features/home/LiveTicker";
import { mergeLeagueScoreboards } from "@/features/home/lib/mergeLeagueScoreboards";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { useMlbScoreboard } from "@/features/mlb/hooks/useMlbScoreboard";
import { useWnbaScoreboard } from "@/features/basketball/hooks/useWnbaScoreboard";

export function HomeChromeLayout() {
  const wnba = useWnbaScoreboard();
  const mlb = useMlbScoreboard();
  const { tickerGames, hasNeverLoaded } = mergeLeagueScoreboards([wnba, mlb]);
  return (
    <div className="flex min-h-screen flex-col bg-background text-white">
      <HomeNav />
      <LiveTicker games={tickerGames} isError={hasNeverLoaded} />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
