import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type { GameDetail } from "../lib/types";
import {
  periodClockLabel,
  relativeLuminance,
  splitPlayText,
} from "./WnbaPlayFeed";

export function NbaPlayFeed({ detail }: { detail: GameDetail }) {
  const [filter, setFilter] = useState<"scoring" | "all">("scoring");
  const filtered =
    filter === "scoring"
      ? detail.plays.filter((play) => play.scoring)
      : detail.plays;

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
          {(["scoring", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-full px-4 py-1.5 text-[14px] font-semibold ${
                filter === value
                  ? "bg-[var(--white)] text-c1"
                  : "text-c3 hover:text-c4"
              }`}
            >
              {value === "scoring" ? "Scoring Plays" : "All Plays"}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-[15px] text-c3">No plays available</p>
      ) : (
        <ul className="space-y-2">
          {[...filtered].reverse().map((play) => {
            const color =
              play.teamId === detail.home.id
                ? detail.home.color
                : detail.away.color;
            const light = relativeLuminance(color) > 0.45;
            const { headline, assist } = splitPlayText(play.text);
            return (
              <li
                key={play.id}
                data-testid={`nba-play-card-${play.id}`}
                className={`rounded px-4 py-3 ${
                  light ? "text-black" : "text-c3"
                }`}
                style={{ backgroundColor: color }}
              >
                <div className="flex justify-between gap-3">
                  <p className="font-semibold">{headline}</p>
                  <span>{periodClockLabel(play.period, play.clock)}</span>
                </div>
                {assist || play.scoring ? (
                  <div className="mt-1.5 flex justify-between gap-3 text-[13px]">
                    <p>{assist ?? ""}</p>
                    {play.scoring ? (
                      <span>
                        {play.awayScore}-{play.homeScore}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </GameSection>
  );
}
