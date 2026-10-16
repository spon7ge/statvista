import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type { GameDetail, GameDetailGameLeaderCard } from "../lib/types";

function Headshot({ card }: { card: GameDetailGameLeaderCard }) {
  const [failed, setFailed] = useState(false);
  if (card.headshotUrl && !failed) {
    return (
      <img
        src={card.headshotUrl}
        alt=""
        data-testid={`nba-game-leader-headshot-${card.key}`}
        className="mt-2 size-14 rounded-full bg-c2 object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      data-testid={`nba-game-leader-headshot-fallback-${card.key}`}
      className="mt-2 flex size-14 items-center justify-center rounded-full bg-c2 text-lg font-semibold text-c3"
    >
      {(card.lastName.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export function NbaGameLeaders({ detail }: { detail: GameDetail }) {
  if (!detail.gameLeaders?.leaders.length) return null;
  return (
    <GameSection data-testid="nba-game-leaders" className="w-full !p-3">
      <h2 className="text-center font-semibold text-c3">Game Leaders</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {detail.gameLeaders.leaders.map((card) => {
          const team = card.side === "away" ? detail.away : detail.home;
          return (
            <div
              key={card.key}
              data-testid={`nba-game-leader-card-${card.key}`}
              className="flex flex-col items-center rounded p-2 text-center"
              style={{ backgroundColor: team.color }}
            >
              <span className="text-[14px] font-semibold tracking-wide text-c3">
                {card.label}
              </span>
              <span className="mt-1 text-[20px] font-semibold tabular-nums text-c3">
                {card.value}
              </span>
              {card.rank != null ? (
                <span
                  data-testid={`nba-game-leader-rank-${card.key}`}
                  className="text-[14px] text-c3"
                >
                  #{card.rank}
                </span>
              ) : null}
              <span className="mt-2 text-[14px] font-semibold uppercase text-c3">
                {card.lastName}
              </span>
              <Headshot card={card} />
            </div>
          );
        })}
      </div>
    </GameSection>
  );
}
