import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import { MlbBaseDiamond } from "./MlbBaseDiamond";
import type {
  MlbBoxScore,
  MlbGameDetailTeam,
  MlbGameDetailView,
  MlbPlayerCard,
} from "../lib/types";

function TeamLogo({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={url}
      alt=""
      role="presentation"
      className="size-5 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function PlayerHeadshot({
  player,
  testId,
}: {
  player: MlbPlayerCard | null;
  testId: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!player?.headshotUrl || failed) {
    return (
      <div
        className="flex size-20 shrink-0 items-center justify-center rounded-full bg-c2 text-base font-semibold text-c3"
        data-testid={testId}
      >
        {player ? player.name.slice(0, 1).toUpperCase() : "?"}
      </div>
    );
  }
  return (
    <img
      src={player.headshotUrl}
      alt={player.name}
      data-testid={testId}
      className="size-20 shrink-0 rounded-full bg-c2 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function OutsDots({ outs }: { outs: number }) {
  const capped = Math.min(Math.max(outs, 0), 3);
  return (
    <span className="flex gap-1.5" aria-label={`${capped} outs`}>
      {Array.from({ length: 3 }, (_, index) => (
        <span
          key={index}
          className={`size-2.5 rounded-full ${
            index < capped ? "bg-c2" : "border border-line"
          }`}
        />
      ))}
    </span>
  );
}

function battingPitchingTeams(detail: MlbGameDetailView): {
  batting: MlbGameDetailTeam;
  pitching: MlbGameDetailTeam;
} {
  if (detail.linescore?.inningHalf === "bottom") {
    return { batting: detail.home, pitching: detail.away };
  }
  return { batting: detail.away, pitching: detail.home };
}

function findBatterPosition(
  boxScore: MlbBoxScore | null,
  side: "away" | "home",
  name: string,
): string | null {
  if (!boxScore) return null;
  const rows =
    side === "away" ? boxScore.awayBatters : boxScore.homeBatters;
  const lastName = name.split(" ").at(-1)?.toLowerCase() ?? "";
  const row = rows.find(
    (batter) =>
      batter.name.toLowerCase() === name.toLowerCase() ||
      batter.name.toLowerCase() === lastName,
  );
  return row?.position ?? null;
}

/** Converts a full player name to "F. Last" (e.g. "Mookie Betts" -> "M. Betts"). */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]![0]!.toUpperCase()}. ${parts[parts.length - 1]}`;
}

function TeamLabel({
  team,
  label,
  align,
}: {
  team: MlbGameDetailTeam;
  label: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
    >
      {team.logoUrl ? <TeamLogo url={team.logoUrl} /> : null}
      <span className="text-[16px] font-semibold text-c3">{label}</span>
    </div>
  );
}

function PlayerNameLine({
  name,
  meta,
  align,
}: {
  name: string;
  meta: string | null;
  align: "left" | "right";
}) {
  return (
    <p
      className={`flex items-baseline gap-1.5 text-[16px] font-bold text-c3 ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
    >
      <span>{name}</span>
      {meta ? (
        <span className="text-[16px] font-medium text-c3">{meta}</span>
      ) : null}
    </p>
  );
}

export function MlbLiveMatchupPanel({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  const situation = detail.situation;
  if (!situation) {
    return (
      <GameSection className="!p-2.5">
        <p className="text-[16px] text-c3">Matchup unavailable</p>
      </GameSection>
    );
  }

  const { batting, pitching } = battingPitchingTeams(detail);
  const battingSide = detail.linescore?.inningHalf === "bottom" ? "home" : "away";
  const atBat = situation.atBat;
  const pitcher = situation.pitching;
  const position =
    atBat != null
      ? findBatterPosition(detail.boxScore, battingSide, atBat.name)
      : null;

  return (
    <GameSection className="!p-3" data-testid="mlb-live-matchup">
      <div className="flex items-center justify-between">
        <TeamLabel team={batting} label="Batting" align="left" />
        <TeamLabel team={pitching} label="Pitching" align="right" />
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <PlayerHeadshot player={atBat} testId="mlb-live-matchup-headshot-batter" />

        <div className="flex shrink-0 flex-col items-center gap-2">
          <MlbBaseDiamond
            runners={situation.runners}
            occupiedFill="rgba(255,255,255,0.95)"
            occupiedStroke="rgba(255,255,255,0.95)"
            className="h-20 w-[6.5rem] shrink-0"
          />
          <OutsDots outs={situation.outs} />
          <p className="text-[20px] font-semibold tabular-nums text-c3">
            {situation.balls} - {situation.strikes}
          </p>
        </div>

        <PlayerHeadshot
          player={pitcher}
          testId="mlb-live-matchup-headshot-pitcher"
        />
      </div>

      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          {atBat ? (
            <>
              <PlayerNameLine
                name={shortName(atBat.name)}
                meta={position}
                align="left"
              />
              {atBat.summary ? (
                <p className="text-[16px] text-c3">{atBat.summary}</p>
              ) : null}
            </>
          ) : (
            <p className="text-[16px] text-c3">Batter TBD</p>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5 text-right">
          {pitcher ? (
            <>
              <PlayerNameLine
                name={shortName(pitcher.name)}
                meta={pitcher.hand}
                align="right"
              />
              {pitcher.summary ? (
                <p className="text-[16px] text-c3">{pitcher.summary}</p>
              ) : null}
            </>
          ) : (
            <p className="text-[16px] text-c3">Pitcher TBD</p>
          )}
        </div>
      </div>
    </GameSection>
  );
}
