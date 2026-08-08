import { GameSection } from "@/shared/ui/GameSection";
import type { MlbGameDetailView } from "../lib/types";

type Props = {
  detail: Pick<MlbGameDetailView, "away" | "home" | "matchupPrediction">;
};

export function MlbMatchupPrediction({ detail }: Props) {
  const prediction = detail.matchupPrediction;
  if (!prediction) return null;

  return (
    <GameSection data-testid="mlb-matchup-prediction">
      <h2 className="text-[18px] font-semibold text-white">Matchup prediction</h2>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full">
        <div
          className="h-full"
          style={{
            width: `${prediction.awayWinPct}%`,
            backgroundColor: detail.away.color,
          }}
        />
        <div
          className="h-full"
          style={{
            width: `${prediction.homeWinPct}%`,
            backgroundColor: detail.home.color,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[14px] text-white/70">
        <span>
          {detail.away.abbrev}{" "}
          <span>{`${prediction.awayWinPct}%`}</span>
        </span>
        <span>
          <span>{`${prediction.homeWinPct}%`}</span> {detail.home.abbrev}
        </span>
      </div>

      <p className="mt-2 text-[14px] text-white/50">{prediction.sourceLabel}</p>
    </GameSection>
  );
}
