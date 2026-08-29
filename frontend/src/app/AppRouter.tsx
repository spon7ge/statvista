import { Navigate, Routes, Route } from "react-router-dom";
import { HomeChromeLayout } from "@/app/layouts/HomeChromeLayout";
import { GameDetailPage } from "@/pages/GameDetailPage";
import { LeagueMatchupsPage } from "@/pages/LeagueMatchupsPage";
import { LeaguePropPicksPage } from "@/pages/LeaguePropPicksPage";
import { WnbaPlayerPropsPage } from "@/pages/WnbaPlayerPropsPage";
import { MlbGameDetailPage } from "@/pages/MlbGameDetailPage";
import { MlbPropPicksPage } from "@/pages/MlbPropPicksPage";
import { LeagueLegsPage } from "@/pages/LeagueLegsPage";
import { LeagueArbitragePage } from "@/pages/LeagueArbitragePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LANDING_HREF } from "@/features/home/lib/appNav";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<HomeChromeLayout />}>
        <Route path="/" element={<Navigate to={LANDING_HREF} replace />} />
        <Route path="/games/:espnEventId" element={<GameDetailPage />} />
        <Route
          path="/wnba/matchups"
          element={<LeagueMatchupsPage league="wnba" />}
        />
        <Route path="/wnba/prop_picks" element={<LeaguePropPicksPage />} />
        <Route path="/wnba/legs" element={<LeagueLegsPage />} />
        <Route path="/wnba/arbitrage" element={<LeagueArbitragePage />} />
        <Route
          path="/wnba/prop_picks/player/:playerSlug"
          element={<WnbaPlayerPropsPage />}
        />

        <Route
          path="/nba/matchups"
          element={<LeagueMatchupsPage league="nba" />}
        />
        <Route
          path="/mlb/matchups"
          element={<LeagueMatchupsPage league="mlb" />}
        />
        <Route path="/mlb/prop_picks" element={<MlbPropPicksPage />} />
        <Route path="/mlb/legs" element={<LeagueLegsPage />} />
        <Route path="/mlb/arbitrage" element={<LeagueArbitragePage />} />
        <Route
          path="/mlb/prop_picks/player/:playerSlug"
          element={<Navigate to="/mlb/prop_picks" replace />}
        />
        <Route path="/mlb/games/:gamePk" element={<MlbGameDetailPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
