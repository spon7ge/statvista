import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type { MlbGameDetailTeam, MlbGameDetailView } from "./types";

function TeamLogo({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={url}
      alt=""
      role="presentation"
      className="size-8 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function TeamRow({ team }: { team: MlbGameDetailTeam }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2.5">
        {team.logoUrl ? <TeamLogo url={team.logoUrl} /> : null}
        <span
          className="truncate text-base font-semibold"
          style={{ color: team.color }}
        >
          {team.name}
        </span>
      </span>
      <span className="shrink-0 font-mono text-xl font-semibold tracking-tight text-white tabular-nums">
        {team.score ?? "–"}
      </span>
    </div>
  );
}

export function MlbGameHeader({ detail }: { detail: MlbGameDetailView }) {
  const inProgress = detail.status === "live" || detail.status === "halftime";

  return (
    <GameSection>
      <p className="mb-3 flex items-center gap-2 text-[14px] text-white/55">
        {inProgress ? (
          <span
            className="size-1.5 shrink-0 animate-pulse rounded-full bg-red-500"
            aria-hidden
          />
        ) : (
          <span
            className="size-1.5 shrink-0 rounded-full bg-white/25"
            aria-hidden
          />
        )}
        <span>
          <span
            className={inProgress ? "text-red-400" : "text-white/80"}
          >
            {detail.statusLabel}
          </span>
          {detail.venue ? (
            <>
              <span className="mx-1.5 text-white/30" aria-hidden>
                ·
              </span>
              <span>{detail.venue}</span>
            </>
          ) : null}
        </span>
      </p>
      <div className="space-y-3">
        <TeamRow team={detail.away} />
        <TeamRow team={detail.home} />
      </div>
    </GameSection>
  );
}
