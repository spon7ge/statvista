import { useState } from "react";
import { IconShare } from "@/shared/ui/Icons";
import type { MlbGameDetailTeam, MlbGameDetailView } from "../lib/types";

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
  team: MlbGameDetailTeam;
  side: "away" | "home";
}) {
  const isAway = side === "away";

  return (
    <div
      data-testid={`mlb-pregame-slab-${side}`}
      className={`relative flex min-h-[8.5rem] flex-col justify-center px-5 py-5 ${
        isAway ? "items-end text-right" : "items-start text-left"
      }`}
      style={{ backgroundColor: team.color }}
    >
      <div className="absolute inset-0 bg-black/35" aria-hidden />

      {/* Logo centered in each team slab */}
      {team.logoUrl ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          data-testid={`mlb-pregame-logo-${side}`}
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
        <span className="text-lg font-bold text-c3">{team.name}</span>
        {team.record ? (
          <span className="text-sm font-medium text-c3">
            {team.record}
          </span>
        ) : null}
        {team.last10 ? (
          <span className="text-xs font-medium text-c3">
            {team.last10} in Last 10
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function MlbPregameBroadcastHeader({
  detail,
  activeTab,
  onTabChange,
}: {
  detail: MlbGameDetailView;
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
    <div data-testid="mlb-pregame-broadcast-header" className="space-y-3">
      <div className="flex items-center justify-between px-1 text-[14px]">
        <span className="text-c3">{detail.gameDateLabel ?? ""}</span>
        <span className="font-medium text-c3">{detail.statusLabel}</span>
        <button
          type="button"
          aria-label="Share"
          className="rounded p-1 text-c3 hover:text-c3"
        >
          <IconShare className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded">
        <TeamSlab team={detail.away} side="away" />
        <TeamSlab team={detail.home} side="home" />
      </div>

      <div
        role="tablist"
        aria-label="Pregame details"
        className="flex items-center justify-center gap-1 border-b border-line"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`mlb-pregame-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`mlb-pregame-${tab.id}-panel`}
            className={`border-b-2 px-5 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-c4 text-c3"
                : "border-transparent text-c3 hover:text-c3"
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
