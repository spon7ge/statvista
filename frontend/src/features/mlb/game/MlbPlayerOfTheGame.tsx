import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type { MlbGameDetailView } from "../lib/types";

function PotgHeadshot({
  url,
  lastName,
}: {
  url: string | null;
  lastName: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(url) && !failed;
  const initial = (lastName.trim()[0] ?? "?").toUpperCase();
  if (show) {
    return (
      <img
        src={url!}
        alt=""
        data-testid="mlb-player-of-the-game-headshot"
        className="size-16 rounded-full bg-white/10 object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      data-testid="mlb-player-of-the-game-headshot-fallback"
      className="flex size-16 items-center justify-center rounded-full bg-white/10 text-xl font-semibold text-white/50"
    >
      {initial}
    </span>
  );
}

export function MlbPlayerOfTheGame({ detail }: { detail: MlbGameDetailView }) {
  const potg = detail.playerOfTheGame;
  if (!potg) return null;
  const statLine = potg.stats.map((s) => s.value).filter(Boolean).join(" · ");

  return (
    <GameSection data-testid="mlb-player-of-the-game" className="w-full !p-4">
      <div className="flex flex-col items-center text-center">
        <PotgHeadshot url={potg.headshotUrl} lastName={potg.lastName} />
        <div className="mt-3 inline-block border-2 border-white px-3 py-1 text-[12px] font-extrabold tracking-wide text-white">
          PLAYER OF THE GAME
        </div>
        <div className="mt-2 text-[18px] font-semibold text-white">{potg.fullName}</div>
        {potg.teamAbbrev ? (
          <div className="mt-1 text-[14px] text-white/60">{potg.teamAbbrev}</div>
        ) : null}
        {statLine ? (
          <div
            data-testid="mlb-player-of-the-game-stats"
            className="mt-3 text-[15px] text-white/90"
          >
            {statLine}
          </div>
        ) : null}
      </div>
    </GameSection>
  );
}
