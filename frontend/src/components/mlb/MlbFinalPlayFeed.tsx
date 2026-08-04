import { useState } from "react";
import { GameSection } from "@/components/game/GameSection";
import type { MlbGameDetailView, MlbPlay } from "./types";

type PlayFilter = "scoring" | "all";

function ordinal(inning: number): string {
  const remainder = inning % 100;
  if (remainder >= 11 && remainder <= 13) return `${inning}th`;

  switch (inning % 10) {
    case 1:
      return `${inning}st`;
    case 2:
      return `${inning}nd`;
    case 3:
      return `${inning}rd`;
    default:
      return `${inning}th`;
  }
}

function eventLabel(event: string | null): string | null {
  if (!event) return null;
  return event
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type HalfInningGroup = {
  key: string;
  half: MlbPlay["half"];
  inning: number;
  plays: MlbPlay[];
};

function groupPlaysByHalfInning(plays: MlbPlay[]): HalfInningGroup[] {
  const groups = new Map<string, HalfInningGroup>();

  for (const play of plays) {
    const key = `${play.inning}-${play.half}`;
    const group = groups.get(key);

    if (group) {
      group.plays.push(play);
    } else {
      groups.set(key, {
        key,
        half: play.half,
        inning: play.inning,
        plays: [play],
      });
    }
  }

  return [...groups.values()];
}

function battingTeamColor(
  detail: MlbGameDetailView,
  half: MlbPlay["half"],
): string {
  return half === "top" ? detail.away.color : detail.home.color;
}

function StatcastMetrics({ play }: { play: MlbPlay }) {
  const metrics = [
    play.exitVelo != null ? `${play.exitVelo} mph` : null,
    play.totalDistance != null ? `${play.totalDistance} ft` : null,
    play.launchAngle != null ? `${play.launchAngle}°` : null,
  ].filter((metric): metric is string => metric != null);

  if (metrics.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-xs text-white/60">
      {metrics.map((metric) => (
        <span key={metric} className="font-mono tabular-nums">
          {metric}
        </span>
      ))}
    </div>
  );
}

function PlayRow({
  play,
  isFirst,
}: {
  play: MlbPlay;
  isFirst: boolean;
}) {
  const event = eventLabel(play.event);

  return (
    <li className={isFirst ? "" : "border-t border-white/10 pt-3"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-white/90">{play.text}</p>
        </div>
        {event ? (
          <span className="shrink-0 rounded-full bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
            {event}
          </span>
        ) : null}
      </div>
      <StatcastMetrics play={play} />
    </li>
  );
}

function HalfInningCard({
  detail,
  group,
}: {
  detail: MlbGameDetailView;
  group: HalfInningGroup;
}) {
  const title = `${group.half === "top" ? "Top" : "Bottom"} ${ordinal(group.inning)}`;

  return (
    <li
      className="overflow-hidden rounded-lg"
      data-testid={`mlb-play-half-${group.half}-${group.inning}`}
      style={{ backgroundColor: battingTeamColor(detail, group.half) }}
    >
      <div className="bg-black/55 p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-white/60">
          {title}
        </h3>
        <ul className="mt-3 space-y-3">
          {group.plays.map((play, index) => (
            <PlayRow key={play.id} play={play} isFirst={index === 0} />
          ))}
        </ul>
      </div>
    </li>
  );
}

export function MlbFinalPlayFeed({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  const [filter, setFilter] = useState<PlayFilter>("scoring");
  const plays = filter === "scoring" ? detail.scoringPlays : detail.plays;
  const playGroups = groupPlaysByHalfInning(plays);

  return (
    <GameSection className="!p-3" data-testid="mlb-final-play-feed">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Play feed</h2>
        <div className="flex rounded-full bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setFilter("scoring")}
            aria-pressed={filter === "scoring"}
            className={`rounded-full px-2 py-1 text-xs font-medium transition-colors ${
              filter === "scoring"
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            Scoring plays
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            className={`rounded-full px-2 py-1 text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            All plays
          </button>
        </div>
      </div>

      {plays.length === 0 ? (
        <p className="text-xs text-white/40">No plays available</p>
      ) : (
        <ul className="space-y-2">
          {playGroups.map((group) => (
            <HalfInningCard key={group.key} detail={detail} group={group} />
          ))}
        </ul>
      )}
    </GameSection>
  );
}
