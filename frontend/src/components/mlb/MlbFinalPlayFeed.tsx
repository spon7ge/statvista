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

function teamColor(
  detail: MlbGameDetailView,
  scoringTeam: MlbPlay["scoringTeam"],
): string | null {
  if (scoringTeam === "away") return detail.away.color;
  if (scoringTeam === "home") return detail.home.color;
  return null;
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

function PlayCard({
  detail,
  play,
}: {
  detail: MlbGameDetailView;
  play: MlbPlay;
}) {
  const color = teamColor(detail, play.scoringTeam);
  const event = eventLabel(play.event);

  return (
    <li
      className="rounded-lg border border-white/10 p-3"
      style={{
        backgroundColor: color
          ? `color-mix(in srgb, ${color} 35%, transparent)`
          : "rgb(255 255 255 / 0.03)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-white/55">
            {play.half === "top" ? "Top" : "Bottom"} {ordinal(play.inning)}
          </p>
          <p className="mt-1 text-sm text-white/90">{play.text}</p>
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

export function MlbFinalPlayFeed({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  const [filter, setFilter] = useState<PlayFilter>("scoring");
  const plays = filter === "scoring" ? detail.scoringPlays : detail.plays;

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
          {plays.map((play) => (
            <PlayCard key={play.id} detail={detail} play={play} />
          ))}
        </ul>
      )}
    </GameSection>
  );
}
