import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { useWnbaProps } from "@/features/basketball/hooks/useWnbaProps";
import {
  appFromSearch,
  type WnbaPropAppTab,
} from "@/features/basketball/league/WnbaPropPicksHeader";
import { WnbaPlayerPropsOddsGrid } from "@/features/basketball/league/WnbaPlayerPropsOddsGrid";
import {
  findPlayerBySlug,
  groupWnbaPropPlayers,
  uniqueStatRows,
  type WnbaPropPlayerCard,
} from "@/features/basketball/league/groupWnbaPropPlayers";

/** Same hidden defaults as the player board (4-pick Power / Standard). */
const BOARD_LEGS = 4;

function formatForApp(app: WnbaPropAppTab): string {
  return app === "underdog" ? "standard" : "power";
}

function teamPosLabel(team: string | null, pos: string | null): string | null {
  const parts = [team, pos].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function PlayerDetailHeader({ player }: { player: WnbaPropPlayerCard }) {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = teamPosLabel(player.team_abbrev, player.position);
  const showImg = Boolean(player.headshot_url) && !imgFailed;
  const initial = (player.player_name.trim()[0] ?? "?").toUpperCase();

  return (
    <header className="flex items-center gap-4">
      {showImg ? (
        <img
          src={player.headshot_url!}
          alt={player.player_name}
          className="size-16 rounded-full object-cover bg-white/10"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          data-testid="wnba-player-props-headshot-fallback"
          className="flex size-16 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white/50"
        >
          {initial}
        </span>
      )}
      <div className="min-w-0">
        {meta ? <p className="text-[14px] text-white/45">{meta}</p> : null}
        <h1 className="truncate text-[28px] font-bold tracking-tight text-white">
          {player.player_name}
        </h1>
      </div>
    </header>
  );
}

export function WnbaPlayerPropsPage() {
  const { playerSlug = "" } = useParams<{ playerSlug: string }>();
  const [params] = useSearchParams();
  const app = appFromSearch(params.get("app"));
  const format = formatForApp(app);
  const boardHref = `/wnba/prop_picks?app=${app}`;

  const { data, isLoading, isError, isFetched } = useWnbaProps({
    app,
    format,
    legs: BOARD_LEGS,
  });

  const players = useMemo(
    () => groupWnbaPropPlayers(data?.props ?? []),
    [data],
  );
  const player = findPlayerBySlug(players, playerSlug);
  const markets = player ? uniqueStatRows(player.rows) : [];

  const showLoading = isLoading && !isFetched;
  const showError = isError && !data;

  let body;
  if (showLoading) {
    body = (
      <div
        className="mx-auto max-w-6xl space-y-4 px-4 pb-16 sm:px-6 sm:pb-20"
        aria-label="Loading WNBA player props"
      >
        <div className="h-20 animate-pulse rounded-xl bg-[#1c1e22]" />
        <div className="h-64 animate-pulse rounded-xl bg-[#1c1e22]" />
      </div>
    );
  } else if (showError) {
    body = (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-sm text-white/60">Prop lines unavailable</p>
        <Link
          to={boardHref}
          className="mt-3 inline-block text-sm font-medium text-white hover:underline"
        >
          Back to Prop Picks
        </Link>
      </div>
    );
  } else if (!player) {
    body = (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-sm text-white/60">Player not found</p>
        <Link
          to={boardHref}
          className="mt-3 inline-block text-sm font-medium text-white hover:underline"
        >
          Back to Prop Picks
        </Link>
      </div>
    );
  } else {
    body = (
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <Link
          to={boardHref}
          className="inline-block text-sm font-medium text-white/55 hover:text-white hover:underline"
        >
          Back to Prop Picks
        </Link>
        <PlayerDetailHeader player={player} />
        <WnbaPlayerPropsOddsGrid markets={markets} />
      </div>
    );
  }

  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="wnba" />
      {body}
    </div>
  );
}
