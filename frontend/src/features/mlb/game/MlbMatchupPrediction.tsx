import { GameSection } from "@/shared/ui/GameSection";
import { mlbTeamLogoUrl } from "../league/mlbTeamLogos";
import type { MlbGameDetailTeam, MlbGameDetailView } from "../lib/types";

type Props = {
  detail: Pick<MlbGameDetailView, "away" | "home" | "matchupPrediction">;
};

function teamLogoSrc(team: MlbGameDetailTeam): string | null {
  return team.logoUrl ?? mlbTeamLogoUrl(team.abbrev);
}

function TeamMark({
  team,
  align,
}: {
  team: MlbGameDetailTeam;
  align: "start" | "end";
}) {
  const logoSrc = teamLogoSrc(team);
  return (
    <div
      className={`flex items-center gap-1.5 ${
        align === "end" ? "flex-row-reverse" : ""
      }`}
    >
      {logoSrc ? (
        <img
          src={logoSrc}
          alt=""
          className="size-6 object-contain"
        />
      ) : null}
      <span className="text-[14px] font-semibold text-c3">{team.abbrev}</span>
    </div>
  );
}

export function MlbMatchupPrediction({ detail }: Props) {
  const prediction = detail.matchupPrediction;
  if (!prediction) return null;

  return (
    <GameSection data-testid="mlb-matchup-prediction">
      <h2 className="text-center font-semibold text-c3">
        Matchup prediction
      </h2>

      <div className="mt-3 flex items-center gap-2">
        <TeamMark team={detail.away} align="start" />
        <div
          data-testid="mlb-matchup-prediction-pill"
          className="flex h-9 min-w-0 flex-1 overflow-hidden rounded-full"
        >
          <div
            className="flex h-full items-center justify-center text-[14px] font-semibold text-c3"
            style={{
              width: `${prediction.awayWinPct}%`,
              backgroundColor: detail.away.color,
            }}
          >
            {`${prediction.awayWinPct}%`}
          </div>
          <div
            className="flex h-full items-center justify-center text-[14px] font-semibold text-c3"
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
