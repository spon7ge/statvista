import { useState } from "react";
import type { GameDetail } from "../lib/types";
import { BoxScore } from "./BoxScore";
import { ShotChart } from "./ShotChart";
import { WinProbabilityPanel } from "./WinProbabilityPanel";
import {
  WnbaBroadcastHeader,
  type WnbaGameTab,
} from "./WnbaBroadcastHeader";
import { WnbaGameInfo } from "./WnbaGameInfo";
import { WnbaPlayFeed } from "./WnbaPlayFeed";
import { WnbaQuarterScoreCard } from "./WnbaQuarterScoreCard";
import { WnbaTeamStatsCard } from "./WnbaTeamStatsCard";

/** Shared Summary|Box shell for live and final; wrappers set distinct test ids. */
export function WnbaInGameCenter({
  detail,
  testId,
}: {
  detail: GameDetail;
  testId: "wnba-live-center" | "wnba-final-center";
}) {
  const [activeTab, setActiveTab] = useState<WnbaGameTab>("summary");

  return (
    <div data-testid={testId} className="space-y-4">
      <WnbaBroadcastHeader
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {activeTab === "summary" ? (
        <div
          id="wnba-summary-panel"
          role="tabpanel"
          aria-labelledby="wnba-summary-tab"
          className="grid items-start gap-4 text-[16px] lg:grid-cols-2"
        >
          <div className="space-y-4">
            <ShotChart detail={detail} />
            <WnbaPlayFeed detail={detail} />
          </div>
          <div className="space-y-4">
            <WnbaQuarterScoreCard detail={detail} />
            <WnbaTeamStatsCard detail={detail} />
            <WinProbabilityPanel detail={detail} />
            <WnbaGameInfo detail={detail} />
          </div>
        </div>
      ) : (
        <div
          id="wnba-box-panel"
          role="tabpanel"
          aria-labelledby="wnba-box-tab"
        >
          <BoxScore detail={detail} />
        </div>
      )}
    </div>
  );
}
