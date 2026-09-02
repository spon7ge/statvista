import { useState } from "react";
import { useMlbGameProps } from "@/features/mlb/hooks/useMlbGameProps";
import { useMlbLineupMatchup } from "@/features/mlb/hooks/useMlbLineupMatchup";
import { useMlbLineups } from "@/features/mlb/hooks/useMlbLineups";
import { useMlbOdds } from "@/features/mlb/hooks/useMlbOdds";
import { useMlbTeamPreview } from "@/features/mlb/hooks/useMlbTeamPreview";
import type { MlbPropAppTab } from "@/features/mlb/league/MlbPropPicksHeader";
import type { ApiMlbLineupGame, ApiMlbLineupSide } from "@/shared/lib/api";
import {
  MlbPregameBroadcastHeader,
  type PregameTab,
} from "./MlbPregameBroadcastHeader";
import { MlbGamePropsGrid } from "./MlbGamePropsGrid";
import { MlbProjectedLineups } from "./MlbProjectedLineups";
import { MlbTeamPreview } from "./MlbTeamPreview";
import { collectMlbOddsBookBoards } from "../lib/mlbOddsBoard";
import type { MlbGameDetailView } from "../lib/types";

const PROPS_APP_TABS: { id: MlbPropAppTab; label: string }[] = [
  { id: "prizepicks", label: "PrizePicks" },
  { id: "underdog", label: "Underdog" },
];

function sideComplete(side: ApiMlbLineupSide | undefined | null): boolean {
  return Boolean(side?.pitcher?.name) && side?.batters?.length === 9;
}

/**
 * Matches a lineup slate entry to the current game detail. Requires an
 * exact (case-insensitive) abbrev match on both sides, plus both sides
 * having a confirmed starter and full 9-batter order, so we never show a
 * partially-projected lineup as if it were final.
 *
 * Note: returns the first complete match, so a doubleheader (same two
 * abbrevs twice in one slate) can't be disambiguated by abbrev alone.
 */
function findCompleteMatch(
  games: ApiMlbLineupGame[] | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
): ApiMlbLineupGame | null {
  if (!games) return null;
  const away = awayAbbrev.toUpperCase();
  const home = homeAbbrev.toUpperCase();
  return (
    games.find(
      (game) =>
        game.away_abbrev.toUpperCase() === away &&
        game.home_abbrev.toUpperCase() === home &&
        sideComplete(game.away) &&
        sideComplete(game.home),
    ) ?? null
  );
}

function GamePropsAppTabs({
  activeApp,
  onAppChange,
}: {
  activeApp: MlbPropAppTab;
  onAppChange: (app: MlbPropAppTab) => void;
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
          id={`mlb-game-props-${tab.id}-tab`}
          type="button"
          role="tab"
          aria-selected={activeApp === tab.id}
          aria-controls={`mlb-game-props-${tab.id}-panel`}
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

export function MlbPregameCenter({ detail }: { detail: MlbGameDetailView }) {
  const [activeTab, setActiveTab] = useState<PregameTab>("preview");
  const [propsApp, setPropsApp] = useState<MlbPropAppTab>("prizepicks");

  const { data, isPending } = useMlbLineups(
    activeTab === "preview" ? detail.gameDate : undefined,
  );
  const oddsQuery = useMlbOdds({ enabled: activeTab === "preview" });
  const matchedGame = findCompleteMatch(
    data?.games,
    detail.away.abbrev,
    detail.home.abbrev,
  );
  const matchupQuery = useMlbLineupMatchup({
    dateEt: detail.gameDate,
    away: detail.away.abbrev,
    home: detail.home.abbrev,
    enabled: activeTab === "preview" && matchedGame !== null,
  });
  const oddsBoards = collectMlbOddsBookBoards(
    oddsQuery.data,
    detail.away.abbrev,
    detail.home.abbrev,
    detail.gameDate ?? undefined,
  );

  const prizeQuery = useMlbGameProps({
    gamePk: detail.mlbGamePk,
    app: "prizepicks",
    enabled: activeTab === "props" && propsApp === "prizepicks",
  });
  const underdogQuery = useMlbGameProps({
    gamePk: detail.mlbGamePk,
    app: "underdog",
    enabled: activeTab === "props" && propsApp === "underdog",
  });

  const propsQuery = propsApp === "underdog" ? underdogQuery : prizeQuery;

  const awayPreview = useMlbTeamPreview({
    gamePk: detail.mlbGamePk,
    side: "away",
    enabled: activeTab === "away",
  });
  const homePreview = useMlbTeamPreview({
    gamePk: detail.mlbGamePk,
    side: "home",
    enabled: activeTab === "home",
  });
  const teamPreviewQuery = activeTab === "home" ? homePreview : awayPreview;

  return (
    <div data-testid="mlb-pregame-center" className="space-y-4">
      <MlbPregameBroadcastHeader
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div
        id={`mlb-pregame-${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`mlb-pregame-${activeTab}-tab`}
      >
        {activeTab === "preview" ? (
          <MlbProjectedLineups
            detail={detail}
            game={matchedGame}
            matchup={matchupQuery.data ?? null}
            isPending={isPending}
            oddsBoards={oddsBoards}
            oddsPending={oddsQuery.isPending}
          />
        ) : activeTab === "props" ? (
          <div className="space-y-4" data-testid="mlb-pregame-props-panel">
            <GamePropsAppTabs
              activeApp={propsApp}
              onAppChange={setPropsApp}
            />
            <div
              id={`mlb-game-props-${propsApp}-panel`}
              role="tabpanel"
              aria-labelledby={`mlb-game-props-${propsApp}-tab`}
            >
              <MlbGamePropsGrid
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
        ) : activeTab === "away" || activeTab === "home" ? (
          <MlbTeamPreview
            data={teamPreviewQuery.data ?? null}
            isPending={teamPreviewQuery.isPending}
            error={
              teamPreviewQuery.isError ? "Failed to load team preview" : null
            }
          />
        ) : null}
      </div>
    </div>
  );
}
