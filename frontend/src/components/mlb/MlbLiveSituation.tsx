import { GameSection } from "@/components/game/GameSection";
import { MlbPitchZone } from "./MlbPitchZone";
import type { MlbGameDetailView, MlbPlayerCard, MlbSituation } from "./types";

function BaseDiamond({ runners }: { runners: MlbSituation["runners"] }) {
  const bases = [
    { key: "second", occupied: runners.second, x: 40, y: 12 },
    { key: "third", occupied: runners.third, x: 16, y: 36 },
    { key: "first", occupied: runners.first, x: 64, y: 36 },
  ] as const;

  return (
    <svg
      viewBox="0 0 80 64"
      className="h-16 w-20"
      role="img"
      aria-label={`Runners: first ${runners.first ? "on" : "empty"}, second ${
        runners.second ? "on" : "empty"
      }, third ${runners.third ? "on" : "empty"}`}
    >
      {bases.map((base) => (
        <rect
          key={base.key}
          x={base.x}
          y={base.y}
          width={12}
          height={12}
          rx={1}
          transform={`rotate(45 ${base.x + 6} ${base.y + 6})`}
          fill={base.occupied ? "rgba(248, 113, 113, 0.85)" : "transparent"}
          stroke={
            base.occupied ? "rgb(248, 113, 113)" : "rgba(255,255,255,0.35)"
          }
          strokeWidth="1.25"
        />
      ))}
    </svg>
  );
}

function CountDots({
  label,
  filled,
  total,
}: {
  label: string;
  filled: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-10 text-[10px] font-medium uppercase tracking-wide text-white/40">
        {label}
      </span>
      <span className="flex gap-1" aria-label={`${filled} ${label}`}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`size-2 rounded-full ${
              index < filled ? "bg-red-400" : "bg-white/15"
            }`}
          />
        ))}
      </span>
    </div>
  );
}

function PlayerSlot({
  label,
  player,
}: {
  label: string;
  player: MlbPlayerCard | null;
}) {
  if (!player) return null;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className="text-sm font-medium text-white">
        {player.name}
        {player.hand ? (
          <span className="ml-1.5 text-xs font-normal text-white/40">
            {player.hand}
          </span>
        ) : null}
      </p>
      {player.summary ? (
        <p className="text-xs text-white/45">{player.summary}</p>
      ) : null}
    </div>
  );
}

function SituationPanel({ detail }: { detail: MlbGameDetailView }) {
  const situation = detail.situation;
  if (!situation) {
    return (
      <GameSection className="!p-3">
        <p className="text-xs text-white/40">Situation unavailable</p>
      </GameSection>
    );
  }

  const stakes = detail.winProbability?.stakes;

  return (
    <GameSection className="!p-3 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <BaseDiamond runners={situation.runners} />
        <div className="space-y-1.5">
          <CountDots label="Balls" filled={situation.balls} total={4} />
          <CountDots label="Strikes" filled={situation.strikes} total={3} />
          <CountDots label="Outs" filled={situation.outs} total={3} />
        </div>
      </div>

      {stakes?.label ? (
        <p className="text-xs text-white/55">{stakes.label}</p>
      ) : null}

      {situation.latestPlayText ? (
        <p className="text-xs text-white/45">{situation.latestPlayText}</p>
      ) : null}

      <div className="space-y-3 border-t border-white/10 pt-3">
        <PlayerSlot label="At bat" player={situation.atBat} />
        <PlayerSlot label="On deck" player={situation.onDeck} />
        <PlayerSlot label="Pitching" player={situation.pitching} />
      </div>
    </GameSection>
  );
}

export function MlbLiveSituation({ detail }: { detail: MlbGameDetailView }) {
  return (
    <div
      className="grid gap-4 lg:grid-cols-2"
      data-testid="mlb-live-situation"
    >
      {detail.situation ? (
        <MlbPitchZone situation={detail.situation} />
      ) : (
        <GameSection className="!p-3">
          <p className="text-xs text-white/40">Pitch zone unavailable</p>
        </GameSection>
      )}
      <SituationPanel detail={detail} />
    </div>
  );
}
