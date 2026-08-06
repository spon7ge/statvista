import { GameSection } from "@/shared/ui/GameSection";
import { MlbLinescore } from "./MlbLinescore";
import type { MlbGameDetailView } from "../lib/types";

function Decision({
  label,
  player,
}: {
  label: "W" | "L" | "S";
  player: string | null;
}) {
  if (!player) return null;

  return (
    <span className="text-[18px]">
      <span className="text-white/45">{label}: </span>
      <span className="font-medium text-white">{player}</span>
    </span>
  );
}

export function MlbFinalLinescoreCard({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  if (!detail.linescore) return null;

  const decisions = detail.decisions;
  const hasDecisions = Boolean(
    decisions?.winner || decisions?.loser || decisions?.save,
  );

  return (
    <GameSection
      className="!p-3 space-y-3"
      data-testid="mlb-final-linescore-card"
    >
      <MlbLinescore detail={detail} embedded />
      {hasDecisions && decisions ? (
        <>
          <div className="border-t border-white/10" />
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-1">
            <Decision label="W" player={decisions.winner} />
            <Decision label="L" player={decisions.loser} />
            <Decision label="S" player={decisions.save} />
          </div>
        </>
      ) : null}
    </GameSection>
  );
}
