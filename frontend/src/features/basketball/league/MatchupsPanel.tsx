import { IconChevron } from "@/shared/ui/Icons";
import { isInProgressStatus } from "@/shared/lib/mapScoreboard";
import { formatMatchupNavLabel } from "@/shared/lib/matchupSlateDate";
import { MatchupGameCard } from "./MatchupGameCard";
import type { MatchupGame } from "./types";

type MatchupsDateNavProps = {
  selectedDate: string;
  todayDate: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onGoToday: () => void;
};

type MatchupsPanelProps = {
  games: MatchupGame[];
  isLoading?: boolean;
  isError?: boolean;
};

export function MatchupsDateNav({
  selectedDate,
  todayDate,
  onPrevDay,
  onNextDay,
  onGoToday,
}: MatchupsDateNavProps) {
  const navLabel = formatMatchupNavLabel(selectedDate, todayDate);
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label="Previous day"
        onClick={onPrevDay}
        className="icon-btn"
      >
        <IconChevron className="icon-rotate-90" />
      </button>
      <button
        type="button"
        onClick={onGoToday}
        className="min-w-14 text-center text-sm font-medium text-c3"
      >
        {navLabel}
      </button>
      <button
        type="button"
        aria-label="Next day"
        onClick={onNextDay}
        className="icon-btn"
      >
        <IconChevron className="icon-rotate-270" />
      </button>
    </div>
  );
}

function MatchupSkeletons() {
  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      aria-label="Loading games"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="h-36 rounded bg-c2" />
      ))}
    </div>
  );
}

function Section({
  label,
  games,
}: {
  label: string;
  games: MatchupGame[];
}) {
  return (
    <section className="space-y-4">
      <h3 className="kicker">{label}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {games.map((game) => (
          <MatchupGameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}

export function MatchupsPanel({
  games,
  isLoading = false,
  isError = false,
}: MatchupsPanelProps) {
  const live = games.filter((game) => isInProgressStatus(game.status));
  const rest = games.filter((game) => !isInProgressStatus(game.status));

  return (
    <section className="space-y-8">
      {games.length === 0 ? (
        isLoading ? (
          <MatchupSkeletons />
        ) : (
          <p
            role={isError ? "status" : undefined}
            className="py-8 text-center text-sm"
          >
            {isError ? "Unable to load games" : "No games on this slate"}
          </p>
        )
      ) : (
        <div className="space-y-8">
          {live.length > 0 ? <Section label="Live now" games={live} /> : null}
          {rest.length > 0 ? (
            <Section label="Rest of the slate" games={rest} />
          ) : null}
        </div>
      )}
    </section>
  );
}
