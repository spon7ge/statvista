import { useMemo, useState } from "react";
import { useWnbaOdds } from "@/features/basketball/hooks/useWnbaOdds";
import { useWnbaProps } from "@/features/basketball/hooks/useWnbaProps";
import { useWnbaTeamPreview } from "@/features/basketball/hooks/useWnbaTeamPreview";
import { filterPropLines } from "@/features/basketball/league/filterPropLines";
import type { ApiWnbaPropLine } from "@/shared/lib/api";
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
import { WnbaTeamPreview } from "./WnbaTeamPreview";

type PropsAppTab = "prizepicks" | "underdog";

const PROPS_APP_TABS: { id: PropsAppTab; label: string }[] = [
  { id: "prizepicks", label: "PrizePicks" },
  { id: "underdog", label: "Underdog" },
];

/** Align ESPN tricodes with props/odds spellings — same map as wnbaOddsBoard. */
const ABBREV_ALIASES: Record<string, string> = {
  GS: "GSV",
  LA: "LAS",
  LV: "LVA",
  NY: "NYL",
  PHX: "PHO",
  POR: "PDX",
  CONN: "CON",
  WSH: "WAS",
};

/** Expand game abbrevs so filterPropLines matches ESPN or odds/props spellings. */
export function gameTeamAbbrevSet(awayAbbrev: string, homeAbbrev: string): Set<string> {
  const out = new Set<string>();
  for (const raw of [awayAbbrev, homeAbbrev]) {
    const upper = raw.trim().toUpperCase();
    if (!upper) continue;
    out.add(upper);
    const canonical = ABBREV_ALIASES[upper] ?? upper;
    out.add(canonical);
    for (const [alias, canon] of Object.entries(ABBREV_ALIASES)) {
      if (canon === upper || canon === canonical) {
        out.add(alias);
        out.add(canon);
      }
    }
  }
  return out;
}

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
      className="flex items-center justify-center gap-1 border-b border-white/10"
    >
      {PROPS_APP_TABS.map((tab) => (
        <button
          key={tab.id}
          id={`wnba-game-props-${tab.id}-tab`}
          type="button"
          role="tab"
          aria-selected={activeApp === tab.id}
          aria-controls={`wnba-game-props-${tab.id}-panel`}
          className={`border-b-2 px-5 py-2 text-[18px] font-medium transition-colors ${
            activeApp === tab.id
              ? "border-white text-white"
              : "border-transparent text-white/50 hover:text-white/80"
          }`}
          onClick={() => onAppChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function formatSide(side: string): string {
  const lower = side.toLowerCase();
  if (lower === "over") return "Over";
  if (lower === "under") return "Under";
  return side;
}

function lineForApp(row: ApiWnbaPropLine, app: PropsAppTab): number | null {
  return row[app]?.line ?? null;
}

function WnbaGamePropsList({
  props,
  app,
  isPending,
}: {
  props: ApiWnbaPropLine[];
  app: PropsAppTab;
  isPending: boolean;
}) {
  if (isPending) {
    return (
      <p className="text-[18px] text-white/50" data-testid="wnba-game-props-list">
        Loading props…
      </p>
    );
  }

  if (props.length === 0) {
    return (
      <p className="text-[18px] text-white/50" data-testid="wnba-game-props-list">
        No props for this game
      </p>
    );
  }

  return (
    <ul className="space-y-1.5" data-testid="wnba-game-props-list">
      {props.map((row) => {
        const line = lineForApp(row, app);
        const key = `${row.player_name}:${row.stat}:${row.side}:${line ?? ""}:${row.team_abbrev ?? ""}`;
        return (
          <li
            key={key}
            className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4rem_4rem] items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-white"
          >
            <span className="truncate font-semibold">{row.player_name}</span>
            <span className="truncate text-white/55">{row.stat}</span>
            <span className="text-center text-white/70">{formatSide(row.side)}</span>
            <span className="text-center font-mono text-white">
              {line != null ? line : "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Scheduled game: pregame tabs + two-column Preview; Away/Home team preview. */
export function WnbaPregameCenter({ detail }: { detail: GameDetail }) {
  const [activeTab, setActiveTab] = useState<PregameTab>("preview");
  const [propsApp, setPropsApp] = useState<PropsAppTab>("prizepicks");
  const oddsQuery = useWnbaOdds();
  const propsQuery = useWnbaProps({ enabled: activeTab === "props" });
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

  const gameTeams = useMemo(
    () => gameTeamAbbrevSet(detail.away.abbrev, detail.home.abbrev),
    [detail.away.abbrev, detail.home.abbrev],
  );

  const filteredProps = useMemo(() => {
    const rows = propsQuery.data?.props ?? [];
    return filterPropLines(rows, {
      stats: new Set(),
      sides: new Set(),
      teams: gameTeams,
      books: new Set([propsApp]),
    });
  }, [propsQuery.data?.props, gameTeams, propsApp]);

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
              <WnbaGamePropsList
                props={filteredProps}
                app={propsApp}
                isPending={propsQuery.isPending}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
