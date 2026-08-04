import { useState } from "react";
import type { MlbGameDetailTeam, MlbGameDetailView } from "./types";

function TeamLogo({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={url}
      alt=""
      role="presentation"
      className="size-14 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function ScoreSlab({ team }: { team: MlbGameDetailTeam }) {
  return (
    <div
      className="relative flex min-h-[7rem] flex-col items-center justify-center gap-2 px-4 py-5"
      style={{ backgroundColor: team.color }}
    >
      <div className="absolute inset-0 bg-black/25" aria-hidden />
      <div className="relative z-10 flex flex-col items-center gap-2">
        {team.logoUrl ? <TeamLogo url={team.logoUrl} /> : null}
        <span className="text-sm font-bold tracking-wide text-white/90">
          {team.abbrev}
        </span>
        <span className="font-mono text-5xl font-bold tabular-nums text-white">
          {team.score ?? "–"}
        </span>
      </div>
    </div>
  );
}

export function MlbLiveBroadcastHeader({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  const inProgress =
    detail.status === "live" || detail.status === "halftime";

  return (
    <div data-testid="mlb-broadcast-header">
      <p className="mb-3 flex items-center gap-2 px-1 text-[14px] text-white/55">
        {inProgress ? (
          <span
            className="size-1.5 shrink-0 animate-pulse rounded-full bg-red-500"
            aria-hidden
          />
        ) : null}
        <span
          className={inProgress ? "font-medium text-red-400" : "text-white/80"}
        >
          {detail.statusLabel}
        </span>
      </p>
      <div className="grid grid-cols-2 overflow-hidden rounded-lg">
        <ScoreSlab team={detail.away} />
        <ScoreSlab team={detail.home} />
      </div>
    </div>
  );
}
