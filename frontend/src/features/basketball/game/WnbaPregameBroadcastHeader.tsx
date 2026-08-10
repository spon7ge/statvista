import { useState } from "react";
import { Share2 } from "lucide-react";
import type { GameDetail, GameDetailTeam } from "../lib/types";

export type PregameTab = "preview" | "away" | "home" | "props";

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

function TeamSlab({
  team,
  side,
}: {
  team: GameDetailTeam;
  side: "away" | "home";
}) {
  const isAway = side === "away";

  return (
    <div
      data-testid={`wnba-pregame-slab-${side}`}
      className={`relative flex min-h-[8.5rem] flex-col justify-center px-5 py-5 ${
        isAway ? "items-end text-right" : "items-start text-left"
      }`}
      style={{ backgroundColor: team.color }}
    >
      <div className="absolute inset-0 bg-black/35" aria-hidden />

      {team.logoUrl ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          data-testid={`wnba-pregame-logo-${side}`}
        >
          <TeamLogo
            url={team.logoUrl}
            className="size-28 shrink-0 object-contain opacity-90 sm:size-32"
          />
        </div>
      ) : null}

      <div
        className={`relative z-20 flex flex-col gap-1 ${
          isAway ? "items-end" : "items-start"
        }`}
      >
        <span className="text-lg font-bold text-white">{team.name}</span>
        {team.record ? (
          <span className="text-sm font-medium text-white/75">
            {team.record}
          </span>
        ) : null}
        {team.last10 ? (
          <span className="text-xs font-medium text-white/60">
            {team.last10} in Last 10
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function WnbaPregameBroadcastHeader({
  detail,
  activeTab,
  onTabChange,
}: {
  detail: GameDetail;
  activeTab: PregameTab;
  onTabChange: (tab: PregameTab) => void;
}) {
  const tabs: { id: PregameTab; label: string }[] = [
    { id: "preview", label: "Preview" },
    { id: "away", label: detail.away.name },
    { id: "home", label: detail.home.name },
    { id: "props", label: "Props" },
  ];

  return (
    <div data-testid="wnba-pregame-broadcast-header" className="space-y-3">
      <div className="flex items-center justify-between px-1 text-[14px]">
        <span className="text-white/80" />
        <span className="font-medium text-white/80">{detail.statusLabel}</span>
        <button
          type="button"
          aria-label="Share"
          className="rounded p-1 text-white/55 hover:text-white/80"
        >
          <Share2 className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg">
        <TeamSlab team={detail.away} side="away" />
        <TeamSlab team={detail.home} side="home" />
      </div>

      <div
        role="tablist"
        aria-label="Pregame details"
        className="flex items-center justify-center gap-1 border-b border-white/10"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`wnba-pregame-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`wnba-pregame-${tab.id}-panel`}
            className={`border-b-2 px-5 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
