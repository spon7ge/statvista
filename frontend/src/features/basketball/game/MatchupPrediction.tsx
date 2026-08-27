import { GameSection } from "@/shared/ui/GameSection";
import type { GameDetail, GameDetailTeam } from "../lib/types";

type MatchupPredictionProps = {
  detail: GameDetail;
};

function TeamMark({
  team,
  align,
}: {
  team: GameDetailTeam;
  align: "start" | "end";
}) {
  return (
    <div
      className={`flex items-center gap-1.5 ${
        align === "end" ? "flex-row-reverse" : ""
      }`}
    >
      {team.logoUrl ? (
        <img src={team.logoUrl} alt="" className="size-6 object-contain" />
      ) : null}
      <span className="text-[14px] font-semibold text-white">{team.abbrev}</span>
    </div>
  );
}

export function MatchupPrediction({ detail }: MatchupPredictionProps) {
  const prediction = detail.matchupPrediction;

  if (!prediction) {
    return null;
  }

  return (
    <GameSection data-testid="wnba-matchup-prediction">
      <h2 className="text-center font-semibold text-white">
        Matchup prediction
      </h2>

      <div className="mt-3 flex items-center gap-2">
        <TeamMark team={detail.away} align="start" />
        <div
          data-testid="wnba-matchup-prediction-pill"
          className="flex h-9 min-w-0 flex-1 overflow-hidden rounded-full"
        >
          <div
            className="flex h-full items-center justify-center text-[14px] font-semibold text-white"
            style={{
              width: `${prediction.awayWinPct}%`,
              backgroundColor: detail.away.color,
            }}
          >
            {`${prediction.awayWinPct}%`}
          </div>
          <div
            className="flex h-full items-center justify-center text-[14px] font-semibold text-white"
            style={{
              width: `${prediction.homeWinPct}%`,
              backgroundColor: detail.home.color,
            }}
          >
            {`${prediction.homeWinPct}%`}
          </div>
        </div>
        <TeamMark team={detail.home} align="end" />
      </div>
    </GameSection>
  );
}
