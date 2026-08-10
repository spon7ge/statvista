import { useState } from "react";
import type { GameDetail, GameDetailTeam } from "../lib/types";

export type WnbaGameTab = "summary" | "box";

function TeamLogo({ url, className }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={url}
      alt=""
      role="presentation"
      className={className ?? "size-24 shrink-0 object-contain"}
      onError={() => setFailed(true)}
    />
  );
}

function resolveWinner(
  away: GameDetailTeam,
  home: GameDetailTeam,
): "away" | "home" | null {
  if (away.score == null || home.score == null) return null;
  if (away.score > home.score) return "away";
  if (home.score > away.score) return "home";
  return null;
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
      data-testid={`wnba-score-slab-${side}`}
      data-winner={isWinner ? "true" : "false"}
      className={`relative flex min-h-[8.5rem] flex-col justify-center px-5 py-5 ${
        isAway ? "items-end text-right" : "items-start text-left"
      } ${isWinner ? "ring-2 ring-inset ring-white/35" : ""}`}
      style={{ backgroundColor: team.color }}
    >
      <div
        className={`absolute inset-0 ${isWinner ? "bg-black/15" : "bg-black/35"}`}
        aria-hidden
      />

      {team.logoUrl ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          data-testid={`wnba-logo-${side}`}
        >
          <TeamLogo
            url={team.logoUrl}
            className="size-28 shrink-0 object-contain opacity-90 sm:size-32"
          />
        </div>
      ) : null}

      <div
        className={`relative z-20 flex flex-col gap-1.5 ${
          isAway ? "items-end" : "items-start"
        }`}
      >
        <span className="text-sm font-bold tracking-wide text-white/90">
          {team.abbrev}
        </span>
        <span
          className={`font-mono font-bold tabular-nums text-white ${
            isWinner ? "text-6xl" : "text-5xl text-white/85"
          }`}
        >
          {team.score ?? "–"}
        </span>
      </div>
    </div>
  );
}

export function WnbaBroadcastHeader({
  detail,
  activeTab,
  onTabChange,
}: {
  detail: GameDetail;
  /** Omit for pregame: status + slabs only, no Summary|Box tabs. */
  activeTab?: WnbaGameTab;
  onTabChange?: (tab: WnbaGameTab) => void;
}) {
  const winner = resolveWinner(detail.away, detail.home);
  const inProgress =
    detail.status === "live" || detail.status === "halftime";
  const showTabs = activeTab != null && onTabChange != null;

  return (
    <div data-testid="wnba-broadcast-header" className="space-y-3">
      {/* Status sits above slabs (venue lives in Game Info only). */}
      <div className="flex items-center justify-center px-1 text-[14px]">
        <span
          className={`flex items-center gap-2 ${
            inProgress ? "font-medium text-red-400" : "font-medium text-white/80"
          }`}
        >
          {inProgress ? (
            <span
              className="size-1.5 shrink-0 animate-pulse rounded-full bg-red-500"
              aria-hidden
            />
          ) : null}
          {detail.statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg">
        <ScoreSlab
          team={detail.away}
          side="away"
          isWinner={winner === "away"}
        />
        <ScoreSlab
          team={detail.home}
          side="home"
          isWinner={winner === "home"}
        />
      </div>

      {showTabs ? (
        <div
          role="tablist"
          aria-label="Game details"
          className="flex items-center justify-center gap-1 border-b border-white/10"
        >
          {(["summary", "box"] as const).map((tab) => (
            <button
              key={tab}
              id={`wnba-${tab}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`wnba-${tab}-panel`}
              className={`border-b-2 px-5 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "border-white text-white"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
              onClick={() => onTabChange(tab)}
            >
              {tab === "summary" ? "Summary" : "Box"}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
