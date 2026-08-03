import { useMemo, useState } from "react";
import { GameSection } from "@/components/game/GameSection";
import { MlbPlayList, MlbScoringPlays } from "./MlbScoringPlays";
import type { MlbGameDetailView } from "./types";

type HalfKey = `${number}-${"top" | "bottom"}`;

function halfKey(inning: number, half: "top" | "bottom"): HalfKey {
  return `${inning}-${half}`;
}

function halfLabel(inning: number, half: "top" | "bottom"): string {
  const side = half === "top" ? "Top" : "Bot";
  return `${side} ${inning}`;
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

  const chronological = detail.plays.filter(
    (play) => halfKey(play.inning, play.half) === activeHalf,
  );

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
        <MlbPlayList plays={chronological} empty="No plays this half" />
      </GameSection>

      <MlbScoringPlays detail={detail} />
    </div>
  );
}
