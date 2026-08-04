import { useState } from "react";
import { MlbBoxScore } from "./MlbBoxScore";
import { MlbFinalBroadcastHeader } from "./MlbFinalBroadcastHeader";
import { MlbFinalLinescoreCard } from "./MlbFinalLinescoreCard";
import { MlbFinalPlayFeed } from "./MlbFinalPlayFeed";
import { MlbFinalTeamStats } from "./MlbFinalTeamStats";
import { MlbHitChart } from "./MlbHitChart";
import { MlbWinProbability } from "./MlbWinProbability";
import type { MlbGameDetailView } from "./types";

type FinalTab = "summary" | "box";

export function MlbFinalCenter({ detail }: { detail: MlbGameDetailView }) {
  const [activeTab, setActiveTab] = useState<FinalTab>("summary");

  return (
    <div data-testid="mlb-final-center" className="space-y-4">
      <MlbFinalBroadcastHeader detail={detail} />
      <div
        role="tablist"
        aria-label="Final game details"
        className="flex border-b border-white/10"
      >
        {(["summary", "box"] as const).map((tab) => (
          <button
            key={tab}
            id={`mlb-final-${tab}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`mlb-final-${tab}-panel`}
            className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      {activeTab === "summary" ? (
        <div
          id="mlb-final-summary-panel"
          role="tabpanel"
          aria-labelledby="mlb-final-summary-tab"
          className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        >
          <MlbFinalPlayFeed detail={detail} />
          <div className="space-y-4">
            <MlbFinalLinescoreCard detail={detail} />
            <MlbFinalTeamStats detail={detail} />
          </div>
        </div>
      ) : (
        <div
          id="mlb-final-box-panel"
          role="tabpanel"
          aria-labelledby="mlb-final-box-tab"
        >
          <MlbBoxScore detail={detail} />
        </div>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <MlbWinProbability detail={detail} />
        <MlbHitChart detail={detail} />
      </div>
    </div>
  );
}
