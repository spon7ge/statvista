import { useState } from "react";
import type { GameDetail } from "../lib/types";
import { BoxScore } from "./BoxScore";
import {
  NbaBroadcastHeader,
  type NbaGameTab,
} from "./NbaBroadcastHeader";
import { NbaGameInfo } from "./NbaGameInfo";
import { NbaPlayFeed } from "./NbaPlayFeed";
import { NbaQuarterScoreCard } from "./NbaQuarterScoreCard";
import { NbaTeamStatsCard } from "./NbaTeamStatsCard";
import { ShotChart } from "./ShotChart";
import { WinProbabilityPanel } from "./WinProbabilityPanel";

export function NbaInGameCenter({
  detail,
  testId,
}: {
  detail: GameDetail;
  testId: "nba-live-center" | "nba-final-center";
}) {
  const [activeTab, setActiveTab] = useState<NbaGameTab>("summary");
  return (
    <div data-testid={testId} className="space-y-4">
      <NbaBroadcastHeader
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {activeTab === "summary" ? (
        <div
          id="nba-summary-panel"
          role="tabpanel"
          aria-labelledby="nba-summary-tab"
          className="grid items-start gap-4 text-[16px] lg:grid-cols-2"
        >
          <div className="space-y-4">
            <ShotChart detail={detail} />
            <NbaPlayFeed detail={detail} />
          </div>
          <div className="space-y-4">
            <NbaQuarterScoreCard detail={detail} />
            <NbaTeamStatsCard detail={detail} />
            <WinProbabilityPanel detail={detail} />
            <NbaGameInfo detail={detail} />
          </div>
        </div>
      ) : (
        <div
          id="nba-box-panel"
          role="tabpanel"
          aria-labelledby="nba-box-tab"
        >
          <BoxScore detail={detail} />
        </div>
      )}
    </div>
  );
}
