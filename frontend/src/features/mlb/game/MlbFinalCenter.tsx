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
import { MlbGameInfo } from "./MlbGameInfo";
import { MlbPlayerOfTheGame } from "./MlbPlayerOfTheGame";
import { MlbWinProbability } from "./MlbWinProbability";
import type { MlbGameDetailView } from "../lib/types";

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
          className="grid items-start gap-4 text-[16px] lg:grid-cols-2"
        >
          <div className="space-y-4">
            <MlbPlayerOfTheGame detail={detail} />
            <MlbFinalPlayFeed detail={detail} />
          </div>
          <div className="space-y-4">
            <MlbFinalLinescoreCard detail={detail} />
            <MlbFinalTeamStats detail={detail} />
            <MlbWinProbability detail={detail} compact />
            <MlbHitChart detail={detail} />
            <MlbGameInfo detail={detail} />
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
