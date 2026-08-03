import { MlbBoxScore } from "./MlbBoxScore";
import { MlbGameHeader } from "./MlbGameHeader";
import { MlbHitChart } from "./MlbHitChart";
import { MlbLinescore } from "./MlbLinescore";
import { MlbScoringPlays } from "./MlbScoringPlays";
import { MlbWinProbability } from "./MlbWinProbability";
import type { MlbGameDetailView } from "./types";

export function MlbFinalCenter({ detail }: { detail: MlbGameDetailView }) {
  return (
    <div data-testid="mlb-final-center" className="space-y-4">
      <MlbGameHeader detail={detail} />
      <MlbLinescore detail={detail} />
      <MlbBoxScore detail={detail} />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <MlbWinProbability detail={detail} />
        <MlbHitChart detail={detail} />
        <MlbScoringPlays detail={detail} />
      </div>
    </div>
  );
}
