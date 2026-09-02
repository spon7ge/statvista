import { GameSection } from "@/shared/ui/GameSection";
import { MlbBaseDiamond } from "./MlbBaseDiamond";
import { MlbPitchZone } from "./MlbPitchZone";
import type { MlbGameDetailView, MlbPlayerCard } from "../lib/types";

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
      <span className="w-9 text-[12px] font-medium text-c3">{label}</span>
      <span className="flex gap-1" aria-label={`${capped} ${label}`}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`size-2 rounded-full ${
              index < capped
                ? filledClassName
                : "border border-line bg-transparent"
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
    <div className="rounded bg-c2 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-wide text-c3">
          CALL VALUE
        </p>
        <span className="rounded bg-c4 px-1.5 py-0.5 text-[12px] font-semibold text-c4">
          {formatStakesBadge(stakes.homeWinDelta)}
        </span>
      </div>
      <p className="mt-2 text-base font-semibold text-c3">{stakes.label}</p>
      <p className="mt-0.5 text-xs text-c3">
        {formatHomeDeltaLine(stakes.homeWinDelta)}
      </p>
      <p className="mt-2 text-[12px] text-c3">
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
      <p className="text-[12px] font-medium uppercase tracking-wide text-c3">
        AT BAT
      </p>
      <p className="text-sm font-semibold text-c3">{player.name}</p>
      {stats ? (
        <p className="text-xs text-c3 tabular-nums">{stats}</p>
      ) : null}
    </div>
  );
}

function OnDeckLine({ player }: { player: MlbPlayerCard }) {
  const stats = playerStatsLine(player);
  return (
    <p className="text-xs text-c3">
      <span className="font-semibold text-c3">ON DECK</span>{" "}
      <span className="font-medium text-c3">{player.name}</span>
      {stats ? (
        <span className="text-c3 tabular-nums">
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
      <p className="text-[12px] font-medium uppercase tracking-wide text-c3">
        PITCHING
      </p>
      <p className="text-sm font-semibold text-c3">{player.name}</p>
      {stats ? (
        <p className="text-xs text-c3 tabular-nums">{stats}</p>
      ) : null}
    </div>
  );
}

function SituationPanel({ detail }: { detail: MlbGameDetailView }) {
  const situation = detail.situation;
  if (!situation) {
    return (
      <GameSection className="!p-2.5">
        <p className="text-xs text-c3">Situation unavailable</p>
      </GameSection>
    );
  }

  const stakes = detail.winProbability?.stakes;

  return (
    <GameSection className="!p-2.5 space-y-3">
      <div className="flex items-start gap-4">
        <MlbBaseDiamond runners={situation.runners} />
        <div className="space-y-1">
          <CountDots
            label="Balls"
            filled={situation.balls}
            total={3}
            filledClassName="bg-c2"
          />
          <CountDots
            label="Strk"
            filled={situation.strikes}
            total={2}
            filledClassName="bg-c2"
          />
          <CountDots
            label="Out"
            filled={situation.outs}
            total={2}
            filledClassName="bg-c4"
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

export function MlbLiveSituation({
  detail,
  variant = "full",
}: {
  detail: MlbGameDetailView;
  variant?: "full" | "pitchZone";
}) {
  const pitchZone = detail.situation ? (
    <MlbPitchZone situation={detail.situation} />
  ) : (
    <GameSection className="!p-2.5">
      <p className="text-xs text-c3">Pitch zone unavailable</p>
    </GameSection>
  );

  if (variant === "pitchZone") {
    return <div data-testid="mlb-live-situation">{pitchZone}</div>;
  }

  return (
    <div
      className="grid gap-4 lg:grid-cols-2"
      data-testid="mlb-live-situation"
    >
      {pitchZone}
      <SituationPanel detail={detail} />
    </div>
  );
}
