import { Link, useParams } from "react-router-dom";
import { useMlbGameDetail } from "@/hooks/useMlbGameDetail";
import { mapMlbGameDetail } from "@/components/mlb/mapMlbGameDetail";
import { MlbBoxScore } from "@/components/mlb/MlbBoxScore";
import { MlbGameHeader } from "@/components/mlb/MlbGameHeader";
import { MlbHitChart } from "@/components/mlb/MlbHitChart";
import { MlbLinescore } from "@/components/mlb/MlbLinescore";
import { MlbLiveSituation } from "@/components/mlb/MlbLiveSituation";
import { MlbPlayByPlay } from "@/components/mlb/MlbPlayByPlay";
import { MlbWinProbability } from "@/components/mlb/MlbWinProbability";
import type { MlbGameDetailView } from "@/components/mlb/types";
import { GAME_SECTION_SURFACE } from "@/components/game/GameSection";

function attributionLabel(sources: string[]): string {
  return sources.includes("espn")
    ? "Data: MLB Stats API · ESPN"
    : "Data: MLB Stats API";
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1 text-sm font-medium text-white/70 no-underline transition-colors hover:text-white"
    >
      ← Back
    </Link>
  );
}

function MlbGameDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6" aria-hidden>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="h-4 w-16 animate-pulse rounded bg-white/10" />
          <span className="h-3 w-20 animate-pulse rounded bg-white/10" />
        </div>
        <div className={GAME_SECTION_SURFACE}>
          <span className="mb-3 block h-3 w-40 animate-pulse rounded bg-white/10" />
          <div className="space-y-3">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center justify-between gap-3">
                <span className="h-4 w-40 animate-pulse rounded bg-white/10" />
                <span className="size-12 shrink-0 animate-pulse rounded-md bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UnableToLoadMlbGame() {
  return (
    <div className="mx-auto max-w-6xl space-y-3 px-4 py-10 text-center sm:px-6">
      <p className="text-sm text-white/60">Unable to load game</p>
      <BackLink />
    </div>
  );
}

function CompactMlbHeader({ detail }: { detail: MlbGameDetailView }) {
  return (
    <div className={GAME_SECTION_SURFACE}>
      <div className="flex items-center justify-between gap-3 text-xs text-white/45">
        <span>{detail.statusLabel}</span>
        {detail.venue ? <span>{detail.venue}</span> : null}
      </div>
      <div className="mt-3 space-y-2">
        {[detail.away, detail.home].map((team) => (
          <div
            key={team.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span style={{ color: team.color }} className="font-medium">
              {team.name}
            </span>
            <span className="font-mono text-white tabular-nums">
              {team.score ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function notLiveMessage(status: MlbGameDetailView["status"]): string {
  if (status === "final") {
    return "Final — live center for completed games coming soon";
  }
  return "Not live yet";
}

export function MlbGameDetailPage() {
  const { gamePk } = useParams<{ gamePk: string }>();
  const { data, isLoading, hasNeverLoaded } = useMlbGameDetail(gamePk);

  if (hasNeverLoaded) {
    return <UnableToLoadMlbGame />;
  }

  if (isLoading && !data) {
    return <MlbGameDetailSkeleton />;
  }

  if (!data) {
    return <UnableToLoadMlbGame />;
  }

  const detail = mapMlbGameDetail(data);

  if (detail.status !== "live") {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <BackLink />
        <CompactMlbHeader detail={detail} />
        <p className="text-sm text-white/60">{notLiveMessage(detail.status)}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink />
        <p className="text-xs text-white/45">
          <span className="text-red-400">{detail.statusLabel}</span>
          {detail.venue ? (
            <>
              <span className="mx-1.5 text-white/30" aria-hidden>
                ·
              </span>
              <span>{detail.venue}</span>
            </>
          ) : null}
          <span className="mx-1.5 text-white/30" aria-hidden>
            ·
          </span>
          <span className="text-white/40">{attributionLabel(detail.sources)}</span>
        </p>
      </div>

      <div data-testid="mlb-live-center" className="space-y-4">
        <MlbGameHeader detail={detail} />
        <MlbLinescore detail={detail} />
        <MlbLiveSituation detail={detail} />
        <MlbPlayByPlay detail={detail} />
        <MlbBoxScore detail={detail} />
        <MlbWinProbability detail={detail} />
        <MlbHitChart detail={detail} />
      </div>
    </div>
  );
}
