import { useState } from "react";
import { Share2 } from "lucide-react";
import type { MlbGameDetailTeam, MlbGameDetailView } from "./types";

export type LiveTab = "summary" | "box";

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

function ScoreSlab({
  team,
  side,
}: {
  team: MlbGameDetailTeam;
  side: "away" | "home";
}) {
  const isAway = side === "away";

  return (
    <div
      data-testid={`mlb-live-score-slab-${side}`}
      data-winner="false"
      className={`relative flex min-h-[8.5rem] flex-col justify-center px-5 py-5 ${
        isAway ? "items-end text-right" : "items-start text-left"
      }`}
      style={{ backgroundColor: team.color }}
    >
      <div className="absolute inset-0 bg-black/35" aria-hidden />

      {team.logoUrl ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          data-testid={`mlb-live-logo-${side}`}
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
        <div className="flex flex-wrap items-center gap-2">
          {isAway ? (
            <>
              {team.record ? (
                <span className="text-xs font-medium text-white/75">
                  {team.record}
                </span>
              ) : null}
              <span className="text-sm font-bold tracking-wide text-white/90">
                {team.abbrev}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-bold tracking-wide text-white/90">
                {team.abbrev}
              </span>
              {team.record ? (
                <span className="text-xs font-medium text-white/75">
                  {team.record}
                </span>
              ) : null}
            </>
          )}
        </div>
        <span className="font-mono text-5xl font-bold tabular-nums text-white/85">
          {team.score ?? "–"}
        </span>
      </div>
    </div>
  );
}

export function MlbLiveBroadcastHeader({
  detail,
  activeTab,
  onTabChange,
}: {
  detail: MlbGameDetailView;
  activeTab: LiveTab;
  onTabChange: (tab: LiveTab) => void;
}) {
  const inProgress =
    detail.status === "live" || detail.status === "halftime";

  return (
    <div data-testid="mlb-broadcast-header" className="space-y-3">
      <div className="flex items-center justify-between px-1 text-[14px]">
        <span className="text-white/80">{detail.gameDateLabel ?? ""}</span>
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
        <button
          type="button"
          aria-label="Share"
          className="rounded p-1 text-white/55 hover:text-white/80"
        >
          <Share2 className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg">
        <ScoreSlab team={detail.away} side="away" />
        <ScoreSlab team={detail.home} side="home" />
      </div>

      <div
        role="tablist"
        aria-label="Live game details"
        className="flex items-center justify-center gap-1 border-b border-white/10"
      >
        {(["summary", "box"] as const).map((tab) => (
          <button
            key={tab}
            id={`mlb-live-${tab}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`mlb-live-${tab}-panel`}
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
    </div>
  );
}
