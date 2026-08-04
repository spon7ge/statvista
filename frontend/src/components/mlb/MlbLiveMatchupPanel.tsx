import { useState, type ReactNode } from "react";
import { GameSection } from "@/components/game/GameSection";
import { MlbBaseDiamond } from "./MlbBaseDiamond";
import type {
  MlbBoxScore,
  MlbGameDetailTeam,
  MlbGameDetailView,
  MlbPlayerCard,
} from "./types";

function TeamLogo({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={url}
      alt=""
      role="presentation"
      className="size-8 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function OutsDots({ outs }: { outs: number }) {
  const capped = Math.min(Math.max(outs, 0), 3);
  return (
    <span className="flex gap-1" aria-label={`${capped} outs`}>
      {Array.from({ length: 3 }, (_, index) => (
        <span
          key={index}
          className={`size-2 rounded-full ${
            index < capped
              ? "bg-red-400"
              : "border border-white/30 bg-transparent"
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

function batterMetaLine(
  player: MlbPlayerCard,
  position: string | null,
): string | null {
  const parts = [position, player.hand].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function PlayerSide({
  team,
  align,
  children,
}: {
  team: MlbGameDetailTeam;
  align: "left" | "right";
  children: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-1 ${
        align === "right" ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <div
        className={`flex items-center gap-2 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {team.logoUrl ? <TeamLogo url={team.logoUrl} /> : null}
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white/90"
          style={{ backgroundColor: team.color }}
        >
          {team.abbrev}
        </span>
      </div>
      {children}
    </div>
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
        <p className="text-xs text-white/40">Matchup unavailable</p>
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
  const batterMeta = atBat ? batterMetaLine(atBat, position) : null;

  return (
    <GameSection className="!p-3" data-testid="mlb-live-matchup">
      <div className="flex items-center gap-3">
        <PlayerSide team={batting} align="left">
          {atBat ? (
            <>
              <p className="text-sm font-semibold text-white">{atBat.name}</p>
              {batterMeta ? (
                <p className="font-mono text-xs text-white/45 tabular-nums">
                  {batterMeta}
                </p>
              ) : null}
              {atBat.summary ? (
                <p className="font-mono text-xs text-white/45 tabular-nums">
                  {atBat.summary}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-white/40">Batter TBD</p>
          )}
        </PlayerSide>

        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <MlbBaseDiamond
            runners={situation.runners}
            occupiedFill="rgba(255,255,255,0.95)"
            occupiedStroke="rgba(255,255,255,0.95)"
          />
          <p className="font-mono text-lg font-semibold tabular-nums text-white">
            {situation.balls} - {situation.strikes}
          </p>
          <OutsDots outs={situation.outs} />
        </div>

        <PlayerSide team={pitching} align="right">
          {pitcher ? (
            <>
              <p className="text-sm font-semibold text-white">{pitcher.name}</p>
              {pitcher.hand ? (
                <p className="font-mono text-xs text-white/45 tabular-nums">
                  {pitcher.hand}
                </p>
              ) : null}
              {pitcher.summary ? (
                <p className="font-mono text-xs text-white/45 tabular-nums">
                  {pitcher.summary}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-white/40">Pitcher TBD</p>
          )}
        </PlayerSide>
      </div>
    </GameSection>
  );
}
