import { Link, useParams } from "react-router-dom";
import { CHROME_PAGE_RIGHT, CHROME_PAGE_X } from "@/app/layouts/chrome";
import { useGameDetail } from "@/features/basketball/hooks/useGameDetail";
import { mapGameDetail } from "@/features/basketball/lib/mapGameDetail";
import { WnbaFinalCenter } from "@/features/basketball/game/WnbaFinalCenter";
import { WnbaLiveCenter } from "@/features/basketball/game/WnbaLiveCenter";
import { WnbaPregameCenter } from "@/features/basketball/game/WnbaPregameCenter";
import { GAME_SECTION_SURFACE } from "@/shared/ui/GameSection";

const PAGE_SHELL = `max-w-6xl space-y-4 py-6 ${CHROME_PAGE_X} ${CHROME_PAGE_RIGHT}`;
const PAGE_EMPTY = `max-w-6xl space-y-3 py-10 text-center ${CHROME_PAGE_X} ${CHROME_PAGE_RIGHT}`;

function GameDetailSkeleton() {
  return (
    <div className={PAGE_SHELL} aria-hidden>
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
      <div className="grid gap-4 lg:grid-cols-2">
        <span className="h-80 animate-pulse rounded bg-white/5" />
        <span className="h-80 animate-pulse rounded bg-white/5" />
      </div>
    </div>
  );
}

function UnableToLoadGame() {
  return (
    <div className={PAGE_EMPTY}>
      <p className="text-sm text-white/60">Unable to load game</p>
      <BackLink />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/wnba/matchups"
      className="inline-flex items-center gap-1 text-sm font-medium text-white/70 no-underline transition-colors hover:text-white"
    >
      ← Back
    </Link>
  );
}

export function GameDetailPage() {
  const { espnEventId } = useParams<{ espnEventId: string }>();
  const { data, isLoading, hasNeverLoaded } = useGameDetail(espnEventId);

  if (hasNeverLoaded) {
    return <UnableToLoadGame />;
  }

  if (isLoading && !data) {
    return <GameDetailSkeleton />;
  }

  if (!data) {
    return <UnableToLoadGame />;
  }

  const detail = mapGameDetail(data);

  let center;
  if (detail.status === "scheduled") {
    center = <WnbaPregameCenter detail={detail} />;
  } else if (detail.status === "final") {
    center = <WnbaFinalCenter detail={detail} />;
  } else {
    // live + halftime
    center = <WnbaLiveCenter detail={detail} />;
  }

  return (
    <div className={PAGE_SHELL}>
      <BackLink />
      {center}
    </div>
  );
}
