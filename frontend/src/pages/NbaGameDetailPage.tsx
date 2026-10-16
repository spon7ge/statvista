import { Link, useParams } from "react-router-dom";
import { CHROME_PAGE_RIGHT, CHROME_PAGE_X } from "@/app/layouts/chrome";
import { NbaFinalCenter } from "@/features/basketball/game/NbaFinalCenter";
import { NbaLiveCenter } from "@/features/basketball/game/NbaLiveCenter";
import { NbaPregameCenter } from "@/features/basketball/game/NbaPregameCenter";
import { useNbaGameDetail } from "@/features/basketball/hooks/useNbaGameDetail";
import { mapGameDetail } from "@/features/basketball/lib/mapGameDetail";
import { GAME_SECTION_SURFACE } from "@/shared/ui/GameSection";

const PAGE_SHELL = `max-w-6xl space-y-4 py-6 ${CHROME_PAGE_X} ${CHROME_PAGE_RIGHT}`;
const PAGE_EMPTY = `max-w-6xl space-y-3 py-10 text-center ${CHROME_PAGE_X} ${CHROME_PAGE_RIGHT}`;

function BackLink() {
  return (
    <Link
      to="/nba/matchups"
      className="inline-flex items-center gap-1 text-sm font-medium text-c3 no-underline transition-colors hover:text-c4"
    >
      ← Back
    </Link>
  );
}

function Skeleton() {
  return (
    <div className={PAGE_SHELL} aria-hidden>
      <div className={GAME_SECTION_SURFACE}>
        <span className="block h-32 animate-pulse rounded bg-c2" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <span className="h-80 animate-pulse rounded bg-c2" />
        <span className="h-80 animate-pulse rounded bg-c2" />
      </div>
    </div>
  );
}

function UnableToLoad() {
  return (
    <div className={PAGE_EMPTY}>
      <p className="text-sm text-c3">Unable to load game</p>
      <BackLink />
    </div>
  );
}

export function NbaGameDetailPage() {
  const { espnEventId } = useParams<{ espnEventId: string }>();
  const { data, isLoading, hasNeverLoaded } =
    useNbaGameDetail(espnEventId);

  if (hasNeverLoaded) return <UnableToLoad />;
  if (isLoading && !data) return <Skeleton />;
  if (!data) return <UnableToLoad />;

  const detail = mapGameDetail(data);
  const center =
    detail.status === "scheduled" ? (
      <NbaPregameCenter detail={detail} />
    ) : detail.status === "final" ? (
      <NbaFinalCenter detail={detail} />
    ) : (
      <NbaLiveCenter detail={detail} />
    );

  return (
    <div className={PAGE_SHELL}>
      <BackLink />
      {center}
    </div>
  );
}
