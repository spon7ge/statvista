import { useState } from "react";
import type { GameDetail, GameDetailTeam } from "../lib/types";

export type NbaGameTab = "summary" | "box";

function TeamLogo({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={url}
      alt=""
      role="presentation"
      className="size-28 shrink-0 object-contain opacity-90 sm:size-32"
      onError={() => setFailed(true)}
    />
  );
}

function winner(
  away: GameDetailTeam,
  home: GameDetailTeam,
): "away" | "home" | null {
  if (away.score == null || home.score == null || away.score === home.score) {
    return null;
  }
  return away.score > home.score ? "away" : "home";
}

function ScoreSlab({
  team,
  side,
  isWinner,
}: {
  team: GameDetailTeam;
  side: "away" | "home";
  isWinner: boolean;
}) {
  const isAway = side === "away";
  return (
    <div
      data-testid={`nba-score-slab-${side}`}
      data-winner={isWinner ? "true" : "false"}
      className={`relative flex min-h-[8.5rem] flex-col justify-center px-5 py-5 ${
        isAway ? "items-end text-right" : "items-start text-left"
      } ${isWinner ? "ring-2 ring-inset ring-c4" : ""}`}
      style={{ backgroundColor: team.color }}
    >
      <div
        className={`absolute inset-0 ${isWinner ? "bg-black/15" : "bg-black/35"}`}
        aria-hidden
      />
      {team.logoUrl ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          data-testid={`nba-logo-${side}`}
        >
          <TeamLogo url={team.logoUrl} />
        </div>
      ) : null}
      <div
        className={`relative z-20 flex flex-col gap-1.5 ${
          isAway ? "items-end" : "items-start"
        }`}
      >
        <span className="text-sm font-bold tracking-wide text-c3">
          {team.abbrev}
        </span>
        <span
          className={`font-bold tabular-nums text-c3 ${
            isWinner ? "text-6xl" : "text-5xl text-c3"
          }`}
        >
          {team.score ?? "–"}
        </span>
      </div>
    </div>
  );
}

export function NbaBroadcastHeader({
  detail,
  activeTab,
  onTabChange,
}: {
  detail: GameDetail;
  activeTab: NbaGameTab;
  onTabChange: (tab: NbaGameTab) => void;
}) {
  const winningSide = winner(detail.away, detail.home);
  const inProgress =
    detail.status === "live" || detail.status === "halftime";

  return (
    <div data-testid="nba-broadcast-header" className="space-y-3">
      <div className="flex items-center justify-center px-1 text-[14px]">
        <span
          className={`flex items-center gap-2 ${
            inProgress ? "font-medium text-c4" : "font-medium text-c3"
          }`}
        >
          {inProgress ? (
            <span
              className="size-1.5 shrink-0 animate-pulse rounded-full bg-c4"
              aria-hidden
            />
          ) : null}
          {detail.statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded">
        <ScoreSlab
          team={detail.away}
          side="away"
          isWinner={winningSide === "away"}
        />
        <ScoreSlab
          team={detail.home}
          side="home"
          isWinner={winningSide === "home"}
        />
      </div>
      <div
        role="tablist"
        aria-label="Game details"
        className="flex items-center justify-center gap-1 border-b border-line"
      >
        {(["summary", "box"] as const).map((tab) => (
          <button
            key={tab}
            id={`nba-${tab}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`nba-${tab}-panel`}
            className={`border-b-2 px-5 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-c4 text-c3"
                : "border-transparent text-c3 hover:text-c3"
            }`}
            onClick={() => onTabChange(tab)}
          >
            {tab === "summary" ? "Summary" : "Boxscore"}
          </button>
        ))}
      </div>
    </div>
  );
}
