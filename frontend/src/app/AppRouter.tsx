import { Routes, Route } from "react-router-dom";
import { HomeChromeLayout } from "@/app/layouts/HomeChromeLayout";
import { HomePage } from "@/pages/HomePage";
import { AboutPage } from "@/pages/AboutPage";
import { GameDetailPage } from "@/pages/GameDetailPage";
import { LeagueMatchupsPage } from "@/pages/LeagueMatchupsPage";
import { LeagueLeadersPage } from "@/pages/LeagueLeadersPage";
import { LeagueStandingsPage } from "@/pages/LeagueStandingsPage";
import { LeagueFuturesPage } from "@/pages/LeagueFuturesPage";
import { LeaguePlayerPage } from "@/pages/LeaguePlayerPage";
import { LeaguePropPicksPage } from "@/pages/LeaguePropPicksPage";
import { MlbGameDetailPage } from "@/pages/MlbGameDetailPage";
import { MlbLeadersPage } from "@/pages/MlbLeadersPage";
import { MlbStandingsPage } from "@/pages/MlbStandingsPage";
import { MlbFuturesPage } from "@/pages/MlbFuturesPage";
import { MlbPlayerPropsPage } from "@/pages/MlbPlayerPropsPage";
import { MlbPropPicksPage } from "@/pages/MlbPropPicksPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<HomeChromeLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/games/:espnEventId" element={<GameDetailPage />} />
        <Route
          path="/wnba/matchups"
          element={<LeagueMatchupsPage league="wnba" />}
        />
        <Route path="/wnba/prop_picks" element={<LeaguePropPicksPage />} />
        <Route path="/wnba/leaders" element={<LeagueLeadersPage />} />
        <Route path="/wnba/standings" element={<LeagueStandingsPage />} />
        <Route path="/wnba/futures" element={<LeagueFuturesPage />} />
        <Route path="/wnba/player/:playerId" element={<LeaguePlayerPage />} />

        <Route
          path="/nba/matchups"
          element={<LeagueMatchupsPage league="nba" />}
        />
        <Route
          path="/mlb/matchups"
          element={<LeagueMatchupsPage league="mlb" />}
        />
        <Route path="/mlb/prop_picks" element={<MlbPropPicksPage />} />
        <Route
          path="/mlb/prop_picks/player/:playerSlug"
          element={<MlbPlayerPropsPage />}
        />
        <Route path="/mlb/leaders" element={<MlbLeadersPage />} />
        <Route path="/mlb/standings" element={<MlbStandingsPage />} />
        <Route path="/mlb/futures" element={<MlbFuturesPage />} />
        <Route path="/mlb/games/:gamePk" element={<MlbGameDetailPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
