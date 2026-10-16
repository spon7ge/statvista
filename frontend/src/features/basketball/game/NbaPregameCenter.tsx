import { useState } from "react";
import { useNbaOdds } from "@/features/basketball/hooks/useNbaOdds";
import { useNbaTeamPreview } from "@/features/basketball/hooks/useNbaTeamPreview";
import { collectNbaOddsBookBoards } from "../lib/nbaOddsBoard";
import type { GameDetail } from "../lib/types";
import { InjuryReport } from "./InjuryReport";
import { MatchupPrediction } from "./MatchupPrediction";
import { NbaGameInfo } from "./NbaGameInfo";
import { NbaGameLeaders } from "./NbaGameLeaders";
import { NbaGameOddsBoard } from "./NbaGameOddsBoard";
import {
  NbaPregameBroadcastHeader,
  type NbaPregameTab,
} from "./NbaPregameBroadcastHeader";
import { NbaSeasonTeamStats } from "./NbaSeasonTeamStats";
import { NbaTeamPreview } from "./NbaTeamPreview";
import { ProjectedStarters } from "./ProjectedStarters";

export function NbaPregameCenter({ detail }: { detail: GameDetail }) {
  const [activeTab, setActiveTab] = useState<NbaPregameTab>("preview");
  const oddsQuery = useNbaOdds();
  const awayPreview = useNbaTeamPreview({
    espnEventId: detail.espnEventId,
    side: "away",
    enabled: activeTab === "away",
  });
  const homePreview = useNbaTeamPreview({
    espnEventId: detail.espnEventId,
    side: "home",
    enabled: activeTab === "home",
  });
  const teamPreviewQuery = activeTab === "home" ? homePreview : awayPreview;
  const boards = collectNbaOddsBookBoards(
    oddsQuery.data,
    detail.away.abbrev,
    detail.home.abbrev,
  );

  return (
    <div data-testid="nba-pregame-center" className="space-y-4">
      <NbaPregameBroadcastHeader
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div
        id={`nba-pregame-${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`nba-pregame-${activeTab}-tab`}
      >
        {activeTab === "preview" ? (
          <div
            data-testid="nba-preview-lineups-odds-grid"
            className="grid items-start gap-4 lg:grid-cols-2"
          >
            <div
              data-testid="nba-preview-left-column"
              className="min-w-0 space-y-4"
            >
              <ProjectedStarters detail={detail} />
              <NbaGameInfo detail={detail} />
              <MatchupPrediction detail={detail} />
              <NbaGameLeaders detail={detail} />
            </div>
            <div
              data-testid="nba-preview-right-column"
              className="min-w-0 space-y-4"
            >
              <NbaGameOddsBoard
                detail={detail}
                boards={boards}
                isPending={oddsQuery.isPending}
              />
              <NbaSeasonTeamStats detail={detail} />
              <InjuryReport detail={detail} />
            </div>
          </div>
        ) : (
          <NbaTeamPreview
            data={teamPreviewQuery.data ?? null}
            isPending={teamPreviewQuery.isPending}
            error={
              teamPreviewQuery.isError ? "Failed to load team preview" : null
            }
          />
        )}
      </div>
    </div>
  );
}
