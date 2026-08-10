import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import { mlbTeamLogoUrl } from "../league/mlbTeamLogos";
import type { MlbGameDetailView, MlbGameLeaderCard } from "../lib/types";

function GameLeaderHeadshot({ card }: { card: MlbGameLeaderCard }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(card.headshotUrl) && !imgFailed;
  const initial = (card.lastName.trim()[0] ?? "?").toUpperCase();

  if (showImg) {
    return (
      <img
        src={card.headshotUrl!}
        alt=""
        data-testid={`mlb-game-leader-headshot-${card.key}`}
        className="mt-2 size-14 rounded-full bg-white/10 object-cover"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      data-testid={`mlb-game-leader-headshot-fallback-${card.key}`}
      className="mt-2 flex size-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white/50"
    >
      {initial}
    </span>
  );
}

export function MlbGameLeaders({ detail }: { detail: MlbGameDetailView }) {
  const payload = detail.gameLeaders;
  if (!payload?.leaders.length) return null;

  return (
    <GameSection data-testid="mlb-game-leaders" className="w-full !p-3">
      <h2 className="text-center text-[18px] font-semibold text-white">
        Game Leaders
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {payload.leaders.map((card) => {
          const team = card.side === "away" ? detail.away : detail.home;
          const logo = team.logoUrl ?? mlbTeamLogoUrl(team.abbrev);
          return (
            <div
              key={card.key}
              data-testid={`mlb-game-leader-card-${card.key}`}
              className="flex flex-col items-center rounded-lg p-2 text-center"
              style={{ backgroundColor: team.color }}
            >
              <span className="text-[14px] font-semibold tracking-wide text-white/70">
                {card.label}
              </span>
              <span className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-white">
                {card.value}
              </span>
              {card.rank != null ? (
                <span
                  data-testid={`mlb-game-leader-rank-${card.key}`}
                  className="text-[14px] text-white/40"
                >{`#${card.rank}`}</span>
              ) : null}
              <div className="mt-2 flex items-center gap-1">
                {logo ? (
                  <img src={logo} alt="" className="size-4 object-contain" />
                ) : null}
                <span className="text-[14px] font-semibold uppercase text-white">
                  {card.lastName}
                </span>
              </div>
              <GameLeaderHeadshot card={card} />
            </div>
          );
        })}
      </div>
    </GameSection>
  );
}
