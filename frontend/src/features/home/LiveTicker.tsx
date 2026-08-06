import { Link } from "react-router-dom";
import { gameDetailHref } from "@/shared/lib/gameDetailHref";
import { isInProgressStatus } from "@/shared/lib/mapScoreboard";
import { TeamAbbrevAvatar } from "@/shared/ui/TeamAbbrevAvatar";
import type { TickerGame } from "./types";

type LiveTickerProps = {
  games?: TickerGame[];
  /** Set only when the scoreboard has never loaded, so good data is never replaced. */
  isError?: boolean;
};

function TickerTeam({
  abbrev,
  logoUrl,
}: {
  abbrev: string;
  logoUrl: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {logoUrl ? (
        <TeamAbbrevAvatar
          abbrev={abbrev}
          logoUrl={logoUrl}
          sizeClassName="size-5"
        />
      ) : null}
      <span className="font-bold text-white">{abbrev}</span>
    </span>
  );
}

function TickerItem({
  game,
  interactive = true,
}: {
  game: TickerGame;
  interactive?: boolean;
}) {
  const isScheduled = game.status === "scheduled";

  const content = isScheduled ? (
    <>
      <TickerTeam abbrev={game.awayAbbrev} logoUrl={game.awayLogoUrl} />
      <span className="text-white/25">@</span>
      <TickerTeam abbrev={game.homeAbbrev} logoUrl={game.homeLogoUrl} />
      <span className="text-white/35">{game.statusLabel}</span>
    </>
  ) : (
    <>
      <TickerTeam abbrev={game.awayAbbrev} logoUrl={game.awayLogoUrl} />
      {game.awayScore !== null ? (
        <span className="text-white/55">{game.awayScore}</span>
      ) : null}
      <span className="text-white/25">—</span>
      <TickerTeam abbrev={game.homeAbbrev} logoUrl={game.homeLogoUrl} />
      {game.homeScore !== null ? (
        <span className="text-white/55">{game.homeScore}</span>
      ) : null}
      <span className="text-white/35">{game.statusLabel}</span>
    </>
  );

  const itemClassName =
    "flex items-center gap-2 px-5 font-mono text-[18px] text-white/70";

  const href = gameDetailHref(game);
  if (href && interactive) {
    return (
      <li className={itemClassName}>
        <Link to={href} className="flex items-center gap-2">
          {content}
        </Link>
      </li>
    );
  }

  return <li className={itemClassName}>{content}</li>;
}

function TickerGameList({
  games,
  keyPrefix,
  interactive = true,
}: {
  games: TickerGame[];
  keyPrefix: string;
  interactive?: boolean;
}) {
  return (
    <ul className="flex shrink-0 items-center whitespace-nowrap">
      {games.map((game) => (
        <TickerItem
          key={`${keyPrefix}-${game.id}`}
          game={game}
          interactive={interactive}
        />
      ))}
    </ul>
  );
}

export function LiveTicker({ games = [], isError = false }: LiveTickerProps) {
  const liveGames = games.filter((g) => isInProgressStatus(g.status));
  const scheduledGames = games.filter((g) => g.status === "scheduled");
  const finalGames = games.filter((g) => g.status === "final");

  const mode: "live" | "today" | "empty" =
    liveGames.length > 0
      ? "live"
      : scheduledGames.length > 0 || finalGames.length > 0
        ? "today"
        : "empty";

  const displayGames =
    mode === "live"
      ? liveGames
      : mode === "today"
        ? [...scheduledGames, ...finalGames]
        : [];

  const isToday = mode === "today";

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="ticker-marquee overflow-hidden bg-[#3a3d42]">
          <div className="flex items-center gap-4 overflow-hidden py-2">
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={
                  isToday
                    ? "size-1.5 rounded-full bg-white/35"
                    : "size-1.5 animate-pulse rounded-full bg-red-500"
                }
                aria-hidden
              />
              <span
                className={
                  isToday
                    ? "text-[10px] font-semibold tracking-widest text-white/40 uppercase"
                    : "text-[10px] font-semibold tracking-widest text-red-400 uppercase"
                }
              >
                {isToday ? "Today" : "Live"}
              </span>
            </div>

            {mode === "empty" ? (
              <p className="truncate text-sm text-white/35">
                {isError ? "Scoreboard unavailable" : "No live games"}
              </p>
            ) : (
              <div className="ticker-marquee-viewport min-w-0 flex-1 overflow-hidden">
                <div className="ticker-marquee-track flex w-max items-center">
                  <TickerGameList games={displayGames} keyPrefix="a" />
                  <div className="ticker-marquee-duplicate" aria-hidden="true">
                    <TickerGameList
                      games={displayGames}
                      keyPrefix="b"
                      interactive={false}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
