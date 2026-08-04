import { useState } from "react";
import { useMlbLineups } from "@/hooks/useMlbLineups";
import type { ApiMlbLineupGame, ApiMlbLineupSide } from "@/lib/api";
import {
  MlbPregameBroadcastHeader,
  type PregameTab,
} from "./MlbPregameBroadcastHeader";
import { MlbProjectedLineups } from "./MlbProjectedLineups";
import type { MlbGameDetailView } from "./types";

function sideComplete(side: ApiMlbLineupSide | undefined | null): boolean {
  return Boolean(side?.pitcher?.name) && side?.batters?.length === 9;
}

/**
 * Matches a lineup slate entry to the current game detail. Requires an
 * exact (case-insensitive) abbrev match on both sides, plus both sides
 * having a confirmed starter and full 9-batter order, so we never show a
 * partially-projected lineup as if it were final.
 */
function findCompleteMatch(
  games: ApiMlbLineupGame[] | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
): ApiMlbLineupGame | null {
  if (!games) return null;
  const away = awayAbbrev.toUpperCase();
  const home = homeAbbrev.toUpperCase();
  const match = games.find(
    (game) =>
      game.away_abbrev.toUpperCase() === away &&
      game.home_abbrev.toUpperCase() === home,
  );
  if (!match) return null;
  return sideComplete(match.away) && sideComplete(match.home) ? match : null;
}

export function MlbPregameCenter({ detail }: { detail: MlbGameDetailView }) {
  const [activeTab, setActiveTab] = useState<PregameTab>("preview");

  const { data } = useMlbLineups(
    activeTab === "preview" ? detail.gameDate : undefined,
  );
  const matchedGame = findCompleteMatch(
    data?.games,
    detail.away.abbrev,
    detail.home.abbrev,
  );

  const stub =
    activeTab === "away"
      ? `${detail.away.name} preview coming soon`
      : `${detail.home.name} preview coming soon`;

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
          <MlbProjectedLineups detail={detail} game={matchedGame} />
        ) : (
          <p className="text-sm text-white/60">{stub}</p>
        )}
      </div>
    </div>
  );
}
