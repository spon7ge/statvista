import { useState } from "react";
import { useWnbaOdds } from "@/features/basketball/hooks/useWnbaOdds";
import { collectWnbaOddsBookBoards } from "../lib/wnbaOddsBoard";
import type { GameDetail } from "../lib/types";
import { InjuryReport } from "./InjuryReport";
import { MatchupPrediction } from "./MatchupPrediction";
import { ProjectedStarters } from "./ProjectedStarters";
import {
  WnbaPregameBroadcastHeader,
  type PregameTab,
} from "./WnbaPregameBroadcastHeader";
import { WnbaGameInfo } from "./WnbaGameInfo";
import { WnbaGameLeaders } from "./WnbaGameLeaders";
import { WnbaGameOddsBoard } from "./WnbaGameOddsBoard";
import { WnbaSeasonTeamStats } from "./WnbaSeasonTeamStats";

function PlaceholderPanel({
  testId,
  label,
}: {
  testId: string;
  label: string;
}) {
  return (
    <p data-testid={testId} className="text-[18px] text-white/50">
      {label}
    </p>
  );
}

/** Scheduled game: pregame tabs + two-column Preview (Away/Home/Props placeholders). */
export function WnbaPregameCenter({ detail }: { detail: GameDetail }) {
  const [activeTab, setActiveTab] = useState<PregameTab>("preview");
  const oddsQuery = useWnbaOdds();
  const oddsBoards = collectWnbaOddsBookBoards(
    oddsQuery.data,
    detail.away.abbrev,
    detail.home.abbrev,
  );

  return (
    <div data-testid="wnba-pregame-center" className="space-y-4">
      <WnbaPregameBroadcastHeader
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div
        id={`wnba-pregame-${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`wnba-pregame-${activeTab}-tab`}
      >
        {activeTab === "preview" ? (
          <div
            data-testid="wnba-preview-lineups-odds-grid"
            className="grid items-start gap-4 lg:grid-cols-2"
          >
            <div
              data-testid="wnba-preview-left-column"
              className="min-w-0 space-y-4"
            >
              <ProjectedStarters detail={detail} />
              <WnbaGameInfo detail={detail} />
              <MatchupPrediction detail={detail} />
              <WnbaGameLeaders detail={detail} />
            </div>
            <div
              data-testid="wnba-preview-right-column"
              className="min-w-0 space-y-4"
            >
              <WnbaGameOddsBoard
                detail={detail}
                boards={oddsBoards}
                isPending={oddsQuery.isPending}
              />
              <WnbaSeasonTeamStats detail={detail} />
              <InjuryReport detail={detail} />
            </div>
          </div>
        ) : activeTab === "away" ? (
          <PlaceholderPanel
            testId="wnba-pregame-away-placeholder"
            label="Away preview coming soon"
          />
        ) : activeTab === "home" ? (
          <PlaceholderPanel
            testId="wnba-pregame-home-placeholder"
            label="Home preview coming soon"
          />
        ) : (
          <PlaceholderPanel
            testId="wnba-pregame-props-placeholder"
            label="Props coming soon"
          />
        )}
      </div>
    </div>
  );
}
