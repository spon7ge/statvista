import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/features/home/AppSidebar";
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
    <div className="flex min-h-screen flex-col bg-background text-white sm:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col self-stretch border-r border-white/10 sm:flex">
        <AppSidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <LiveTicker games={tickerGames} isError={hasNeverLoaded} />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
