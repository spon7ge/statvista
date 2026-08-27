import { useState } from "react";
import type { ApiWnbaGamePropsResponse } from "@/shared/lib/api";
import { GameSection } from "@/shared/ui/GameSection";
import { bookDisplayName } from "@/features/basketball/lib/wnbaBookLabels";
import { formatAmericanOdds } from "@/features/basketball/lib/wnbaOddsBoard";

export type WnbaGamePropCategory =
  ApiWnbaGamePropsResponse["categories"][number];
export type WnbaGamePropPlayer = WnbaGamePropCategory["players"][number];
export type WnbaGamePropBestQuote = NonNullable<WnbaGamePropPlayer["over"]>;

const VISIBLE_ROW_LIMIT = 5;

export type WnbaGamePropsGridProps = {
  categories: WnbaGamePropCategory[];
  isPending?: boolean;
  error?: string | null;
  onPlayerClick?: (player: WnbaGamePropPlayer) => void;
};

function OddsPill({ quote }: { quote: WnbaGamePropBestQuote | null }) {
  if (!quote) {
    return <div className="min-w-[4.5rem]" aria-hidden="true" />;
  }

  return (
    <div className="flex min-w-[4.5rem] flex-col items-center justify-center rounded-lg bg-white/10 px-2 py-1.5 text-center">
      <span className="font-mono text-sm font-semibold leading-tight text-white">
        {formatAmericanOdds(quote.american)}
      </span>
      <span className="mt-0.5 truncate text-[11px] font-medium leading-tight text-white/45">
        {bookDisplayName(quote.book)}
      </span>
    </div>
  );
}

function PlayerAvatar({ player }: { player: WnbaGamePropPlayer }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(player.headshot_url) && !imgFailed;
  const initial = (player.player_name.trim()[0] ?? "?").toUpperCase();

  if (showImg) {
    return (
      <img
        src={player.headshot_url!}
        alt=""
        className="size-8 shrink-0 rounded-full object-cover bg-white/10"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/50">
      {initial}
    </span>
  );
}

function PlayerRowContent({ player }: { player: WnbaGamePropPlayer }) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <PlayerAvatar player={player} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {player.player_name}
          </p>
          {player.team_abbrev ? (
            <p className="truncate text-[11px] text-white/45">
              {player.team_abbrev}
            </p>
          ) : null}
        </div>
      </div>
      <span className="text-center font-mono text-sm text-white">
        {player.line}
      </span>
      <OddsPill quote={player.over} />
      <OddsPill quote={player.under} />
    </>
  );
}

const ROW_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_2.5rem_auto_auto] items-center gap-2";

function CategoryCard({
  category,
  onPlayerClick,
}: {
  category: WnbaGamePropCategory;
  onPlayerClick?: (player: WnbaGamePropPlayer) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = category.players.length > VISIBLE_ROW_LIMIT;
  const visiblePlayers = expanded
    ? category.players
    : category.players.slice(0, VISIBLE_ROW_LIMIT);

  return (
    <GameSection
      className="!p-3"
      data-testid={`wnba-game-props-category-${category.stat}`}
    >
      <div className={`${ROW_GRID} mb-2 px-0.5`}>
        <h3 className="truncate font-semibold text-white">
          {category.label}
        </h3>
        <span className="text-center text-[11px] font-medium uppercase tracking-wide text-white/45">
          Line
        </span>
        <span className="min-w-[4.5rem] text-center text-[11px] font-medium uppercase tracking-wide text-white/45">
          Over
        </span>
        <span className="min-w-[4.5rem] text-center text-[11px] font-medium uppercase tracking-wide text-white/45">
          Under
        </span>
      </div>

      <ul className="space-y-1.5">
        {visiblePlayers.map((player) => {
          const key = `${player.player_name}:${player.line}:${player.team_abbrev ?? ""}`;
          if (onPlayerClick) {
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onPlayerClick(player)}
                  className={`${ROW_GRID} rounded-lg px-0.5 py-1 text-left transition-colors hover:bg-white/5`}
                >
                  <PlayerRowContent player={player} />
                </button>
              </li>
            );
          }
          return (
            <li key={key} className={`${ROW_GRID} px-0.5 py-1`}>
              <PlayerRowContent player={player} />
            </li>
          );
        })}
      </ul>

      {canToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 rounded-md border border-white/10 px-2.5 py-0.5 text-xs text-white/55 hover:text-white"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </GameSection>
  );
}

function softErrorBannerText(error: string): string {
  if (error === "odds_api_unavailable") {
    return "Some book quotes may be incomplete";
  }
  if (error === "roster_unavailable") {
    return "Player details may be incomplete";
  }
  if (
    error.includes("odds_api_unavailable") &&
    error.includes("roster_unavailable")
  ) {
    return "Some data sources unavailable";
  }
  return error;
}

export function WnbaGamePropsGrid({
  categories,
  isPending = false,
  error = null,
  onPlayerClick,
}: WnbaGamePropsGridProps) {
  if (isPending) {
    return (
      <p className="text-[18px] text-white/50" data-testid="wnba-game-props-grid">
        Loading props…
      </p>
    );
  }

  // Only blank the grid when there is nothing to show. Soft service `error`
  // (and hard query failures) must not hide categories that already loaded.
  if (categories.length === 0) {
    return (
      <p className="text-[18px] text-white/50" data-testid="wnba-game-props-grid">
        {error || "No props available for this matchup"}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="wnba-game-props-grid">
      {error ? (
        <p
          className="text-sm text-white/40"
          data-testid="wnba-game-props-soft-error"
        >
          {softErrorBannerText(error)}
        </p>
      ) : null}
      {/* CSS columns pack vertically so a short card lets the next one sit flush. */}
      <div
        className="columns-1 gap-4 lg:columns-2"
        data-testid="wnba-game-props-columns"
      >
        {categories.map((category) => (
          <div
            key={category.stat}
            className="mb-4 break-inside-avoid last:mb-0"
          >
            <CategoryCard
              category={category}
              onPlayerClick={onPlayerClick}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
