import { Link } from "react-router-dom";
import draftKingsLogo from "@/assets/draftkings.png";
import fanDuelLogo from "@/assets/fanduel.png";
import { gameDetailHref } from "@/shared/lib/gameDetailHref";
import { isInProgressStatus } from "@/shared/lib/mapScoreboard";
import { TeamAbbrevAvatar } from "@/shared/ui/TeamAbbrevAvatar";
import { IconChevron } from "@/shared/ui/Icons";
import { formatOddsPill } from "@/shared/lib/mergeMatchupOdds";
import type { MatchupGame, MatchupOdds, MatchupTeam } from "./types";

function TeamRow({
  team,
  showScore,
}: {
  team: MatchupTeam;
  showScore: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <TeamAbbrevAvatar
        abbrev={team.abbrev}
        logoUrl={team.logoUrl}
        sizeClassName="size-8"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] text-c3">{team.name}</span>
        {team.record ? (
          <span className="block text-[14px] text-c3">{team.record}</span>
        ) : null}
      </span>
      {showScore ? (
        <span className="shrink-0 text-[16px] font-semibold tracking-tight text-c3">
          {team.score ?? "–"}
        </span>
      ) : null}
    </div>
  );
}

function OddsByCaption({ sportsbook }: { sportsbook?: string | null }) {
  const book = (sportsbook || "draftkings").toLowerCase();
  if (book === "pinnacle") {
    return (
      <p className="mt-1 text-right text-[14px] tracking-wide text-c3">
        Odds by Pinnacle
      </p>
    );
  }
  const isFanDuel = book === "fanduel";
  return (
    <p className="mt-1 flex items-center justify-end gap-1 text-[14px] tracking-wide text-c3">
      <span>Odds by</span>
      <img
        src={isFanDuel ? fanDuelLogo : draftKingsLogo}
        alt={isFanDuel ? "FanDuel" : "DraftKings"}
        className="h-4 w-4 object-contain"
      />
    </p>
  );
}

function OddsBlock({
  label,
  placement,
  sportsbook,
}: {
  label: string;
  placement: "under-scores" | "beside-home";
  sportsbook?: string | null;
}) {
  return (
    <div
      data-testid="matchup-odds"
      data-placement={placement}
      data-sportsbook={(sportsbook || "draftkings").toLowerCase()}
      className="shrink-0 text-right"
    >
      <span className="inline-flex max-w-[11rem] rounded-full border border-line bg-c2 px-2 py-1 text-[14px] text-c3 sm:max-w-none">
        {label}
      </span>
      <OddsByCaption sportsbook={sportsbook} />
    </div>
  );
}

export function MatchupGameCard({ game }: { game: MatchupGame }) {
  const isLive = isInProgressStatus(game.status);
  const showScores = game.status !== "scheduled";
  const venueLabel = game.venue
    ? [game.venue, game.venueCity].filter(Boolean).join(" · ")
    : null;
  const odds: MatchupOdds | null | undefined = game.odds;
  const oddsLabel = odds ? formatOddsPill(odds) : null;

  const content = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-start justify-between gap-3">
          <span
            className={`flex shrink-0 items-center gap-2 text-[16px] ${
              isLive ? "status-live" : "text-c3"
            }`}
          >
            {game.statusLabel}
          </span>
          {venueLabel ? (
            <span className="truncate text-right text-[14px] text-c3">
              {venueLabel}
            </span>
          ) : null}
        </div>
        {showScores ? (
          <div className="space-y-3">
            <TeamRow team={game.away} showScore />
            <TeamRow team={game.home} showScore />
            {oddsLabel && odds ? (
              <div className="flex justify-end">
                <OddsBlock
                  label={oddsLabel}
                  placement="under-scores"
                  sportsbook={odds.sportsbook}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <TeamRow team={game.away} showScore={false} />
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <TeamRow team={game.home} showScore={false} />
              </div>
              {oddsLabel && odds ? (
                <OddsBlock
                  label={oddsLabel}
                  placement="beside-home"
                  sportsbook={odds.sportsbook}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
      <IconChevron className="icon-rotate-270 shrink-0" />
    </div>
  );

  const href = gameDetailHref(game);
  if (href) {
    return (
      <Link to={href} className="card">
        {content}
      </Link>
    );
  }

  return <article className="card">{content}</article>;
}
