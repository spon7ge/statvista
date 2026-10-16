import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type { GameDetail, GameDetailPlay } from "../lib/types";
import {
  periodClockLabel,
  relativeLuminance,
  splitPlayText,
} from "./WnbaPlayFeed";

type PlayFilter = "scoring" | "all";

function teamColorFor(
  detail: GameDetail,
  teamId: string | null | undefined,
): string {
  if (teamId === detail.away.id) return detail.away.color;
  if (teamId === detail.home.id) return detail.home.color;
  return detail.away.color;
}

function PlayCard({
  detail,
  play,
}: {
  detail: GameDetail;
  play: GameDetailPlay;
}) {
  const backgroundColor = teamColorFor(detail, play.teamId);
  const lightCard = relativeLuminance(backgroundColor) > 0.45;
  const primary = lightCard ? "text-black" : "text-c3";
  const secondary = lightCard ? "text-black/55" : "text-c3";
  const { headline, assist } = splitPlayText(play.text);

  return (
    <li
      data-testid={`nba-play-card-${play.id}`}
      className="rounded px-4 py-3"
      style={{ backgroundColor }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`min-w-0 flex-1 text-[15px] font-semibold leading-snug ${primary}`}>
          {headline}
        </p>
        <span className={`shrink-0 text-[13px] font-medium tabular-nums ${primary}`}>
          {periodClockLabel(play.period, play.clock)}
        </span>
      </div>
      {(assist || play.scoring) && (
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className={`min-w-0 flex-1 text-[13px] leading-snug ${secondary}`}>
            {assist ?? ""}
          </p>
          {play.scoring ? (
            <span className={`shrink-0 text-[13px] font-medium tabular-nums ${secondary}`}>
              {play.awayScore}-{play.homeScore}
            </span>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function NbaPlayFeed({ detail }: { detail: GameDetail }) {
  const [filter, setFilter] = useState<PlayFilter>("scoring");
  const filtered =
    filter === "scoring"
      ? detail.plays.filter((play) => play.scoring)
      : detail.plays;
  const plays = [...filtered].reverse();

  return (
    <GameSection
      className="!p-3 h-fit self-start"
      data-testid="nba-play-feed"
    >
      <div className="mb-3 flex justify-center">
        <div
          className="flex rounded-full bg-c2 p-1"
          role="group"
          aria-label="Play filter"
        >
          <button
            type="button"
            onClick={() => setFilter("scoring")}
            aria-pressed={filter === "scoring"}
            className={`rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors ${
              filter === "scoring"
                ? "bg-[var(--white)] text-c1"
                : "text-c3 hover:text-c4"
            }`}
          >
            Scoring Plays
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            className={`rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors ${
              filter === "all"
                ? "bg-[var(--white)] text-c1"
                : "text-c3 hover:text-c4"
            }`}
          >
            All Plays
          </button>
        </div>
      </div>
      {plays.length === 0 ? (
        <p className="text-[15px] text-c3">No plays available</p>
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
