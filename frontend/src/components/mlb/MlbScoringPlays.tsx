import { GameSection } from "@/components/game/GameSection";
import type { MlbGameDetailView, MlbPlay } from "./types";

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

export function MlbPlayList({
  plays,
  empty,
}: {
  plays: MlbPlay[];
  empty: string;
}) {
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

export function MlbScoringPlays({ detail }: { detail: MlbGameDetailView }) {
  return (
    <GameSection className="!p-3" data-testid="mlb-scoring-plays">
      <h2 className="mb-2 text-sm font-semibold text-white">Scoring plays</h2>
      <MlbPlayList
        plays={detail.scoringPlays}
        empty="No scoring plays yet"
      />
    </GameSection>
  );
}
