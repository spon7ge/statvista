import { GameSection } from "@/shared/ui/GameSection";
import type { MlbGameDetailView, MlbPlay } from "../lib/types";

function EventBadge({ event }: { event: string | null }) {
  if (!event) return null;
  const isHr = event.toUpperCase() === "HR";
  return (
    <span
      className={`shrink-0 rounded px-1 py-0.5 text-[12px] font-medium uppercase tracking-wide ${
        isHr ? "bg-c2 text-c4" : "bg-c2 text-c3"
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
    return <p className="text-xs text-c3">{empty}</p>;
  }

  return (
    <ul className="space-y-0.5 text-xs">
      {plays.map((play) => (
        <li
          key={play.id}
          className={`flex items-start gap-1.5 rounded px-1.5 py-1 ${
            play.scoring ? "bg-c2" : ""
          }`}
        >
          <EventBadge event={play.event} />
          <span className="min-w-0 flex-1 text-c3">{play.text}</span>
          {play.scoring ? (
            <span className="shrink-0 font-semibold text-c3 tabular-nums">
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
      <h2 className="mb-2 font-semibold text-c3">Scoring plays</h2>
      <MlbPlayList
        plays={detail.scoringPlays}
        empty="No scoring plays yet"
      />
    </GameSection>
  );
}
