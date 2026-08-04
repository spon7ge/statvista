import { useState } from "react";
import { MlbBoxScore } from "./MlbBoxScore";
import {
  MlbFinalBroadcastHeader,
  type FinalTab,
} from "./MlbFinalBroadcastHeader";
import { MlbFinalLinescoreCard } from "./MlbFinalLinescoreCard";
import { MlbFinalPlayFeed } from "./MlbFinalPlayFeed";
import { MlbFinalTeamStats } from "./MlbFinalTeamStats";
import { MlbHitChart } from "./MlbHitChart";
import { MlbWinProbability } from "./MlbWinProbability";
import type { MlbGameDetailView } from "./types";

export function MlbFinalCenter({ detail }: { detail: MlbGameDetailView }) {
  const [activeTab, setActiveTab] = useState<FinalTab>("summary");

  return (
    <div data-testid="mlb-final-center" className="space-y-4">
      <MlbFinalBroadcastHeader
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {activeTab === "summary" ? (
        <div
          id="mlb-final-summary-panel"
          role="tabpanel"
          aria-labelledby="mlb-final-summary-tab"
          className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        >
          <MlbFinalPlayFeed detail={detail} />
          <div className="space-y-4">
            <MlbFinalLinescoreCard detail={detail} />
            <MlbFinalTeamStats detail={detail} />
            <MlbWinProbability detail={detail} compact />
            <MlbHitChart detail={detail} />
          </div>
        </div>
      ) : (
        <div
          id="mlb-final-box-panel"
          role="tabpanel"
          aria-labelledby="mlb-final-box-tab"
        >
          <MlbBoxScore detail={detail} sideBySide />
        </div>
      )}
    </div>
  );
}
