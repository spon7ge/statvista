import { GameSection } from "@/components/game/GameSection";
import { MlbLinescore } from "./MlbLinescore";
import type { MlbGameDetailView } from "./types";

type DecisionLabel = "W" | "L" | "S";

function Decision({
  label,
  player,
}: {
  label: DecisionLabel;
  player: string | null;
}) {
  if (!player) return null;

  return (
    <span className="text-xs text-white/70">{`${label}: ${player}`}</span>
  );
}

export function MlbFinalLinescoreCard({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  if (!detail.linescore) return null;

  const decisions = detail.decisions;

  return (
    <div data-testid="mlb-final-linescore-card" className="space-y-2">
      <MlbLinescore detail={detail} />
      {decisions ? (
        <GameSection className="!p-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Decision label="W" player={decisions.winner} />
            <Decision label="L" player={decisions.loser} />
            <Decision label="S" player={decisions.save} />
          </div>
        </GameSection>
      ) : null}
    </div>
  );
}
