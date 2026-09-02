import { useState } from "react";
import { useWnbaGameProps } from "@/features/basketball/hooks/useWnbaGameProps";
import { useWnbaOdds } from "@/features/basketball/hooks/useWnbaOdds";
import { useWnbaTeamPreview } from "@/features/basketball/hooks/useWnbaTeamPreview";
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
import { WnbaGamePropsGrid } from "./WnbaGamePropsGrid";
import { WnbaSeasonTeamStats } from "./WnbaSeasonTeamStats";
import { WnbaTeamPreview } from "./WnbaTeamPreview";

type PropsAppTab = "prizepicks" | "underdog";

const PROPS_APP_TABS: { id: PropsAppTab; label: string }[] = [
  { id: "prizepicks", label: "PrizePicks" },
  { id: "underdog", label: "Underdog" },
];

function GamePropsAppTabs({
  activeApp,
  onAppChange,
}: {
  activeApp: PropsAppTab;
  onAppChange: (app: PropsAppTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="DFS app"
      className="flex items-center justify-center gap-1 border-b border-line"
    >
      {PROPS_APP_TABS.map((tab) => (
        <button
          key={tab.id}
          id={`wnba-game-props-${tab.id}-tab`}
          type="button"
          role="tab"
          aria-selected={activeApp === tab.id}
          aria-controls={`wnba-game-props-${tab.id}-panel`}
          className={`border-b-2 px-5 py-2 text-[16px] font-medium transition-colors ${
            activeApp === tab.id
              ? "border-c4 text-c3"
              : "border-transparent text-c3 hover:text-c3"
          }`}
          onClick={() => onAppChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Scheduled game: pregame tabs + two-column Preview; Away/Home team preview. */
export function WnbaPregameCenter({ detail }: { detail: GameDetail }) {
  const [activeTab, setActiveTab] = useState<PregameTab>("preview");
  const [propsApp, setPropsApp] = useState<PropsAppTab>("prizepicks");
  const oddsQuery = useWnbaOdds();

  const prizeQuery = useWnbaGameProps({
    espnEventId: detail.espnEventId,
    app: "prizepicks",
    enabled: activeTab === "props" && propsApp === "prizepicks",
  });
  const underdogQuery = useWnbaGameProps({
    espnEventId: detail.espnEventId,
    app: "underdog",
    enabled: activeTab === "props" && propsApp === "underdog",
  });
  const propsQuery = propsApp === "underdog" ? underdogQuery : prizeQuery;

  const oddsBoards = collectWnbaOddsBookBoards(
    oddsQuery.data,
    detail.away.abbrev,
    detail.home.abbrev,
  );

  const awayPreview = useWnbaTeamPreview({
    espnEventId: detail.espnEventId,
    side: "away",
    enabled: activeTab === "away",
  });
  const homePreview = useWnbaTeamPreview({
    espnEventId: detail.espnEventId,
    side: "home",
    enabled: activeTab === "home",
  });
  const teamPreviewQuery = activeTab === "home" ? homePreview : awayPreview;

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
        ) : activeTab === "away" || activeTab === "home" ? (
          <WnbaTeamPreview
            data={teamPreviewQuery.data ?? null}
            isPending={teamPreviewQuery.isPending}
            error={
              teamPreviewQuery.isError ? "Failed to load team preview" : null
            }
          />
        ) : activeTab === "props" ? (
          <div className="space-y-4" data-testid="wnba-pregame-props-panel">
            <GamePropsAppTabs activeApp={propsApp} onAppChange={setPropsApp} />
            <div
              id={`wnba-game-props-${propsApp}-panel`}
              role="tabpanel"
              aria-labelledby={`wnba-game-props-${propsApp}-tab`}
            >
              <WnbaGamePropsGrid
                categories={propsQuery.data?.categories ?? []}
                isPending={propsQuery.isPending}
                error={
                  propsQuery.isError
                    ? "Failed to load props"
                    : propsQuery.data?.error
                }
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
