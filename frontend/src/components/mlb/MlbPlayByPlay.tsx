import { useMemo, useState } from "react";
import { GameSection } from "@/components/game/GameSection";
import type { MlbGameDetailView, MlbPlay } from "./types";

type HalfKey = `${number}-${"top" | "bottom"}`;

function halfKey(inning: number, half: "top" | "bottom"): HalfKey {
  return `${inning}-${half}`;
}

function halfLabel(inning: number, half: "top" | "bottom"): string {
  const side = half === "top" ? "Top" : "Bot";
  return `${side} ${inning}`;
}

function EventBadge({ event }: { event: string | null }) {
  if (!event) return null;
  const isHr = event.toUpperCase() === "HR";
  return (
    <span
      className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        isHr ? "bg-red-500/15 text-red-400" : "bg-white/10 text-white/50"
      }`}
    >
      {event}
    </span>
  );
}

function PlayList({ plays, empty }: { plays: MlbPlay[]; empty: string }) {
  if (plays.length === 0) {
    return <p className="text-xs text-white/40">{empty}</p>;
  }

  return (
    <ul className="space-y-0.5 text-xs">
      {plays.map((play) => (
        <li
          key={play.id}
          className={`flex items-start gap-1.5 rounded-md px-1.5 py-1 ${
            play.scoring ? "bg-white/5" : ""
          }`}
        >
          <EventBadge event={play.event} />
          <span className="min-w-0 flex-1 text-white/80">{play.text}</span>
          {play.scoring ? (
            <span className="shrink-0 font-mono font-semibold text-white tabular-nums">
              {play.awayScore}-{play.homeScore}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function MlbPlayByPlay({ detail }: { detail: MlbGameDetailView }) {
  const halves = useMemo(() => {
    const seen = new Map<HalfKey, { inning: number; half: "top" | "bottom" }>();
    for (const play of detail.plays) {
      const key = halfKey(play.inning, play.half);
      if (!seen.has(key)) {
        seen.set(key, { inning: play.inning, half: play.half });
      }
    }
    return Array.from(seen.values()).sort((a, b) => {
      if (a.inning !== b.inning) return a.inning - b.inning;
      return a.half === b.half ? 0 : a.half === "top" ? -1 : 1;
    });
  }, [detail.plays]);

  const currentHalf: HalfKey | null = (() => {
    const inning = detail.linescore?.currentInning;
    const half = detail.linescore?.inningHalf;
    if (inning != null && half) return halfKey(inning, half);
    if (halves.length > 0) {
      const last = halves[halves.length - 1];
      return halfKey(last.inning, last.half);
    }
    return null;
  })();

  const [selectedHalf, setSelectedHalf] = useState<HalfKey | null>(null);
  const activeHalf = selectedHalf ?? currentHalf;

  // Keep API relative order; mapper preserves chronological feed order.
  const chronological = detail.plays.filter(
    (play) => halfKey(play.inning, play.half) === activeHalf,
  );

  const scoringPlays = detail.scoringPlays;

  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="mlb-play-by-play">
      <GameSection className="!p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Play-by-play</h2>
          <div className="flex flex-wrap items-center gap-0.5">
            {halves.map(({ inning, half }) => {
              const key = halfKey(inning, half);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedHalf(key)}
                  aria-pressed={activeHalf === key}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    activeHalf === key
                      ? "bg-white/15 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {halfLabel(inning, half)}
                </button>
              );
            })}
          </div>
        </div>
        <PlayList plays={chronological} empty="No plays this half" />
      </GameSection>

      <GameSection className="!p-3">
        <h2 className="mb-2 text-sm font-semibold text-white">Scoring plays</h2>
        <PlayList plays={scoringPlays} empty="No scoring plays yet" />
      </GameSection>
    </div>
  );
}
