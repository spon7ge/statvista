import { useState } from "react";
import { MlbBoxScore } from "./MlbBoxScore";
import {
  MlbLiveBroadcastHeader,
  type LiveTab,
} from "./MlbLiveBroadcastHeader";
import { MlbFinalLinescoreCard } from "./MlbFinalLinescoreCard";
import { MlbFinalPlayFeed } from "./MlbFinalPlayFeed";
import { MlbFinalTeamStats } from "./MlbFinalTeamStats";
import { MlbHitChart } from "./MlbHitChart";
import { MlbLiveMatchupPanel } from "./MlbLiveMatchupPanel";
import { MlbPitchZone } from "./MlbPitchZone";
import { MlbWinProbability } from "./MlbWinProbability";
import type { MlbGameDetailView } from "./types";

export function MlbLiveCenter({ detail }: { detail: MlbGameDetailView }) {
  const [activeTab, setActiveTab] = useState<LiveTab>("summary");

  return (
    <div data-testid="mlb-live-center" className="space-y-4">
      <MlbLiveBroadcastHeader
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {activeTab === "summary" ? (
        <div
          id="mlb-live-summary-panel"
          role="tabpanel"
          aria-labelledby="mlb-live-summary-tab"
          className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        >
          <div className="space-y-4">
            <MlbLiveMatchupPanel detail={detail} />
            {detail.situation ? (
              <MlbPitchZone situation={detail.situation} />
            ) : null}
            <MlbFinalPlayFeed detail={detail} />
          </div>
          <div className="space-y-4">
            <MlbFinalLinescoreCard detail={detail} />
            <MlbFinalTeamStats detail={detail} />
            <MlbWinProbability detail={detail} compact />
            <MlbHitChart detail={detail} />
          </div>
        </div>
      ) : (
        <div
          id="mlb-live-box-panel"
          role="tabpanel"
          aria-labelledby="mlb-live-box-tab"
        >
          <MlbBoxScore detail={detail} sideBySide />
        </div>
      )}
    </div>
  );
}
