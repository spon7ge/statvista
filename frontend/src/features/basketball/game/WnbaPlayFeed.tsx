import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type { GameDetail, GameDetailPlay } from "../lib/types";

type PlayFilter = "scoring" | "all";

/** Split ESPN play text into headline + optional assist line (no parentheses). */
export function splitPlayText(text: string): {
  headline: string;
  assist: string | null;
} {
  // ESPN variants:
  //   "... jumper (Assisted by V. Burton)"
  //   "... jumper (V. Burton assists)"
  //   "... jumper Assisted by V. Burton"
  const paren = /\s*\(([^)]*)\)\s*$/.exec(text);
  if (paren) {
    const inside = paren[1].trim();
    const assistedBy = /^Assisted by\s+(.+)$/i.exec(inside);
    const nameAssists = /^(.+?)\s+assists$/i.exec(inside);
    if (assistedBy || nameAssists) {
      const name = (assistedBy?.[1] ?? nameAssists?.[1] ?? "")
        .replace(/[()]/g, "")
        .trim();
      return {
        headline: text.slice(0, paren.index).trim(),
        assist: name ? `Assisted by ${name}` : null,
      };
    }
  }

  const inline = /\s+Assisted by\s+(.+)$/i.exec(text);
  if (inline) {
    const name = inline[1].replace(/[()]/g, "").trim();
    return {
      headline: text.slice(0, inline.index).trim(),
      assist: name ? `Assisted by ${name}` : null,
    };
  }

  return { headline: text, assist: null };
}

export function periodClockLabel(period: number, clock: string): string {
  const quarter =
    period <= 4 ? `${period}Q` : period === 5 ? "OT" : `${period - 4}OT`;
  return `${quarter} ${clock}`;
}

/** Relative luminance 0–1 for choosing light vs dark text on team-color cards. */
export function relativeLuminance(hex: string): number {
  const raw = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return 0;
  const channel = (offset: number) => {
    const value = parseInt(raw.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

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
  const primary = lightCard ? "text-black" : "text-white";
  const secondary = lightCard ? "text-black/55" : "text-white/70";
  const { headline, assist } = splitPlayText(play.text);

  return (
    <li
      data-testid={`wnba-play-card-${play.id}`}
      className="rounded-2xl px-4 py-3"
      style={{ backgroundColor }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`min-w-0 flex-1 text-[15px] font-semibold leading-snug ${primary}`}>
          {headline}
        </p>
        <span
          className={`shrink-0 text-[13px] font-medium tabular-nums ${primary}`}
        >
          {periodClockLabel(play.period, play.clock)}
        </span>
      </div>
      {(assist || play.scoring) && (
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className={`min-w-0 flex-1 text-[13px] leading-snug ${secondary}`}>
            {assist ?? ""}
          </p>
          {play.scoring ? (
            <span
              className={`shrink-0 text-[13px] font-medium tabular-nums ${secondary}`}
            >
              {play.awayScore}-{play.homeScore}
            </span>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function WnbaPlayFeed({ detail }: { detail: GameDetail }) {
  const [filter, setFilter] = useState<PlayFilter>("scoring");
  const filtered =
    filter === "scoring"
      ? detail.plays.filter((play) => play.scoring)
      : detail.plays;
  // API is newest-first; Scores-style list runs chronologically (oldest on top).
  const plays = [...filtered].reverse();

  return (
    <GameSection
      className="!p-3 h-fit self-start"
      data-testid="wnba-play-feed"
    >
      <div className="mb-3 flex justify-center">
        <div
          className="flex rounded-full bg-white/10 p-1"
          role="group"
          aria-label="Play filter"
        >
          <button
            type="button"
            onClick={() => setFilter("scoring")}
            aria-pressed={filter === "scoring"}
            className={`rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors ${
              filter === "scoring"
                ? "bg-white text-black"
                : "text-white/80 hover:text-white"
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
                ? "bg-white text-black"
                : "text-white/80 hover:text-white"
            }`}
          >
            All Plays
          </button>
        </div>
      </div>

      {plays.length === 0 ? (
        <p className="text-[15px] text-white/40">No plays available</p>
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
