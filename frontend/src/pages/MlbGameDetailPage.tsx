import { useParams } from "react-router-dom";
import { CHROME_PAGE_RIGHT, CHROME_PAGE_X } from "@/app/layouts/chrome";
import { useMlbGameDetail } from "@/features/mlb/hooks/useMlbGameDetail";
import { mapMlbGameDetail } from "@/features/mlb/lib/mapMlbGameDetail";
import { MlbFinalCenter } from "@/features/mlb/game/MlbFinalCenter";
import { MlbLiveCenter } from "@/features/mlb/game/MlbLiveCenter";
import { MlbPregameCenter } from "@/features/mlb/game/MlbPregameCenter";
import type { MlbGameDetailView } from "@/features/mlb/lib/types";
import { GAME_SECTION_SURFACE } from "@/shared/ui/GameSection";

const PAGE_SHELL = `max-w-6xl space-y-4 py-6 ${CHROME_PAGE_X} ${CHROME_PAGE_RIGHT}`;
const PAGE_EMPTY = `max-w-6xl space-y-3 py-10 text-center ${CHROME_PAGE_X} ${CHROME_PAGE_RIGHT}`;

function MlbGameDetailSkeleton() {
  return (
    <div className={PAGE_SHELL} aria-hidden>
      <div className={GAME_SECTION_SURFACE}>
        <span className="mb-3 block h-3 w-40 animate-pulse rounded bg-c2" />
        <div className="space-y-3">
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center justify-between gap-3">
              <span className="h-4 w-40 animate-pulse rounded bg-c2" />
              <span className="size-12 shrink-0 animate-pulse rounded bg-c2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UnableToLoadMlbGame() {
  return (
    <div className={PAGE_EMPTY}>
      <p className="text-sm text-c3">Unable to load game</p>
    </div>
  );
}

function CompactMlbHeader({ detail }: { detail: MlbGameDetailView }) {
  return (
    <div className={GAME_SECTION_SURFACE}>
      <div className="flex items-center justify-between gap-3 text-xs text-c3">
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
            <span className="text-c3 tabular-nums">
              {team.score ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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

  if (detail.status === "scheduled") {
    return (
      <div className={PAGE_SHELL}>
        <MlbPregameCenter detail={detail} />
      </div>
    );
  }

  if (detail.status === "halftime") {
    return (
      <div className={PAGE_SHELL}>
        <CompactMlbHeader detail={detail} />
        <p className="text-sm text-c3">Not live yet</p>
      </div>
    );
  }

  if (detail.status === "final") {
    return (
      <div className={PAGE_SHELL}>
        <MlbFinalCenter detail={detail} />
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
      <MlbLiveCenter detail={detail} />
    </div>
  );
}
