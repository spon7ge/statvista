import { GameSection } from "@/components/game/GameSection";
import { MlbPitchZone } from "./MlbPitchZone";
import type { MlbGameDetailView, MlbPlayerCard, MlbSituation } from "./types";

function BaseDiamond({ runners }: { runners: MlbSituation["runners"] }) {
  const bases = [
    { key: "second", occupied: runners.second, x: 34, y: 8 },
    { key: "third", occupied: runners.third, x: 12, y: 30 },
    { key: "first", occupied: runners.first, x: 56, y: 30 },
  ] as const;

  return (
    <svg
      viewBox="0 0 80 56"
      className="h-14 w-[4.5rem] shrink-0"
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
          width={11}
          height={11}
          rx={1}
          transform={`rotate(45 ${base.x + 5.5} ${base.y + 5.5})`}
          fill={base.occupied ? "rgba(248, 113, 113, 0.9)" : "transparent"}
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
  filledClassName,
}: {
  label: string;
  filled: number;
  total: number;
  filledClassName: string;
}) {
  const capped = Math.min(Math.max(filled, 0), total);
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 text-[10px] font-medium text-white/45">{label}</span>
      <span className="flex gap-1" aria-label={`${capped} ${label}`}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`size-2 rounded-full ${
              index < capped
                ? filledClassName
                : "border border-white/30 bg-transparent"
            }`}
          />
        ))}
      </span>
    </div>
  );
}

/** Map win-% delta to display points (fraction ≤1 → ×100; else already points). */
function stakesPoints(delta: number): number {
  return Math.abs(delta) <= 1 ? Math.abs(delta) * 100 : Math.abs(delta);
}

function formatStakesBadge(delta: number): string {
  const pts = stakesPoints(delta);
  const text = Number.isInteger(pts) ? String(pts) : pts.toFixed(1);
  return `${text} pts`;
}

function formatHomeDeltaLine(delta: number): string {
  const pts = Math.abs(delta) <= 1 ? delta * 100 : delta;
  const sign = pts >= 0 ? "+" : "";
  return `home ${sign}${pts.toFixed(1)} pts`;
}

function CallValueCard({
  stakes,
}: {
  stakes: { label: string; homeWinDelta: number };
}) {
  return (
    <div className="rounded-lg border border-white/10 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">
          CALL VALUE
        </p>
        <span className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
          {formatStakesBadge(stakes.homeWinDelta)}
        </span>
      </div>
      <p className="mt-2 text-base font-semibold text-white">{stakes.label}</p>
      <p className="mt-0.5 text-xs text-white/45">
        {formatHomeDeltaLine(stakes.homeWinDelta)}
      </p>
      <p className="mt-2 text-[10px] text-white/30">
        Data: ESPN win probability
      </p>
    </div>
  );
}

function playerStatsLine(player: MlbPlayerCard): string | null {
  const parts = [player.hand, player.summary].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function AtBatBlock({ player }: { player: MlbPlayerCard }) {
  const stats = playerStatsLine(player);
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">
        AT BAT
      </p>
      <p className="text-sm font-semibold text-white">{player.name}</p>
      {stats ? (
        <p className="font-mono text-xs text-white/45 tabular-nums">{stats}</p>
      ) : null}
    </div>
  );
}

function OnDeckLine({ player }: { player: MlbPlayerCard }) {
  const stats = playerStatsLine(player);
  return (
    <p className="text-xs text-white/55">
      <span className="font-semibold text-white">ON DECK</span>{" "}
      <span className="font-medium text-white">{player.name}</span>
      {stats ? (
        <span className="font-mono text-white/45 tabular-nums">
          {" "}
          · {stats}
        </span>
      ) : null}
    </p>
  );
}

function PitchingBlock({ player }: { player: MlbPlayerCard }) {
  const stats = playerStatsLine(player);
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">
        PITCHING
      </p>
      <p className="text-sm font-semibold text-white">{player.name}</p>
      {stats ? (
        <p className="font-mono text-xs text-white/45 tabular-nums">{stats}</p>
      ) : null}
    </div>
  );
}

function SituationPanel({ detail }: { detail: MlbGameDetailView }) {
  const situation = detail.situation;
  if (!situation) {
    return (
      <GameSection className="!p-2.5">
        <p className="text-xs text-white/40">Situation unavailable</p>
      </GameSection>
    );
  }

  const stakes = detail.winProbability?.stakes;

  return (
    <GameSection className="!p-2.5 space-y-3">
      <div className="flex items-start gap-4">
        <BaseDiamond runners={situation.runners} />
        <div className="space-y-1">
          <CountDots
            label="Balls"
            filled={situation.balls}
            total={3}
            filledClassName="bg-white"
          />
          <CountDots
            label="Strk"
            filled={situation.strikes}
            total={2}
            filledClassName="bg-white"
          />
          <CountDots
            label="Out"
            filled={situation.outs}
            total={2}
            filledClassName="bg-red-400"
          />
        </div>
      </div>

      {stakes ? <CallValueCard stakes={stakes} /> : null}

      <div className="space-y-2.5">
        {situation.atBat ? <AtBatBlock player={situation.atBat} /> : null}
        {situation.onDeck ? <OnDeckLine player={situation.onDeck} /> : null}
        {situation.pitching ? (
          <PitchingBlock player={situation.pitching} />
        ) : null}
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
        <GameSection className="!p-2.5">
          <p className="text-xs text-white/40">Pitch zone unavailable</p>
        </GameSection>
      )}
      <SituationPanel detail={detail} />
    </div>
  );
}
