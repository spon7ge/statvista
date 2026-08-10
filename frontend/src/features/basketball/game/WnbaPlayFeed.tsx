import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type { GameDetail, GameDetailPlay } from "../lib/types";

type PlayFilter = "scoring" | "all";

type PeriodGroup = {
  period: number;
  plays: GameDetailPlay[];
};

function periodLabel(period: number): string {
  const ordinals = ["1st", "2nd", "3rd", "4th"];
  if (period <= ordinals.length) return ordinals[period - 1];
  const ot = period - ordinals.length;
  return ot === 1 ? "OT" : `${ot}OT`;
}

function groupPlaysByPeriod(plays: GameDetailPlay[]): PeriodGroup[] {
  const groups = new Map<number, PeriodGroup>();

  for (const play of plays) {
    const group = groups.get(play.period);
    if (group) {
      group.plays.push(play);
    } else {
      groups.set(play.period, { period: play.period, plays: [play] });
    }
  }

  // Preserve encounter order (newest-first API order → newest period first).
  return [...groups.values()];
}

function teamColorFor(
  detail: GameDetail,
  teamId: string | null | undefined,
): string {
  if (teamId === detail.away.id) return detail.away.color;
  if (teamId === detail.home.id) return detail.home.color;
  return detail.away.color;
}

function PlayRow({
  play,
  isFirst,
}: {
  play: GameDetailPlay;
  isFirst: boolean;
}) {
  return (
    <li className={isFirst ? "" : "border-t border-white/10 pt-3"}>
      <div className="flex items-start gap-2">
        <span className="w-10 shrink-0 font-mono text-[18px] tabular-nums text-white/60">
          {play.clock}
        </span>
        <p className="min-w-0 flex-1 text-[18px] text-white/90">{play.text}</p>
        {play.scoring ? (
          <span className="shrink-0 font-mono text-[18px] font-semibold tabular-nums text-white">
            {play.awayScore}-{play.homeScore}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function PeriodCard({
  detail,
  group,
}: {
  detail: GameDetail;
  group: PeriodGroup;
}) {
  const teamColor = teamColorFor(detail, group.plays[0]?.teamId);

  return (
    <li
      className="overflow-hidden rounded-lg"
      data-testid={`wnba-play-period-${group.period}`}
      style={{ backgroundColor: teamColor }}
    >
      <div className="bg-black/55 p-3">
        <h3 className="text-[18px] font-medium uppercase tracking-wide text-white/60">
          {periodLabel(group.period)}
        </h3>
        <ul className="mt-3 space-y-3">
          {group.plays.map((play, index) => (
            <PlayRow key={play.id} play={play} isFirst={index === 0} />
          ))}
        </ul>
      </div>
    </li>
  );
}

export function WnbaPlayFeed({ detail }: { detail: GameDetail }) {
  const [filter, setFilter] = useState<PlayFilter>("scoring");
  const plays =
    filter === "scoring"
      ? detail.plays.filter((play) => play.scoring)
      : detail.plays;
  const playGroups = groupPlaysByPeriod(plays);

  return (
    <GameSection
      className="!p-3 h-fit self-start"
      data-testid="wnba-play-feed"
    >
      <div className="mb-3 flex justify-center">
        <div
          className="flex rounded-full bg-white/5 p-0.5"
          role="group"
          aria-label="Play filter"
        >
          <button
            type="button"
            onClick={() => setFilter("scoring")}
            aria-pressed={filter === "scoring"}
            className={`rounded-full px-2 py-1 text-[18px] font-medium transition-colors ${
              filter === "scoring"
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            Scoring plays
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            className={`rounded-full px-2 py-1 text-[18px] font-medium transition-colors ${
              filter === "all"
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            All plays
          </button>
        </div>
      </div>

      {plays.length === 0 ? (
        <p className="text-[18px] text-white/40">No plays available</p>
      ) : (
        <ul className="space-y-2">
          {playGroups.map((group) => (
            <PeriodCard key={group.period} detail={detail} group={group} />
          ))}
        </ul>
      )}
    </GameSection>
  );
}
