import { GameSection } from "@/components/game/GameSection";
import type {
  MlbBatterRow,
  MlbGameDetailTeam,
  MlbGameDetailView,
  MlbPitcherRow,
} from "./types";

const BATTER_COLS = ["AB", "R", "H", "RBI", "BB", "SO"] as const;
const PITCHER_COLS = ["IP", "H", "R", "ER", "BB", "K", "P"] as const;

function batterValues(row: MlbBatterRow): Array<string | number> {
  return [
    row.ab ?? "–",
    row.r ?? "–",
    row.h ?? "–",
    row.rbi ?? "–",
    row.bb ?? "–",
    row.so ?? "–",
  ];
}

function pitcherValues(row: MlbPitcherRow): Array<string | number> {
  return [
    row.ip ?? "–",
    row.h ?? "–",
    row.r ?? "–",
    row.er ?? "–",
    row.bb ?? "–",
    row.k ?? "–",
    row.pitches ?? "–",
  ];
}

function BatterTable({
  team,
  batters,
}: {
  team: MlbGameDetailTeam;
  batters: MlbBatterRow[];
}) {
  if (batters.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <div className="mb-1.5 flex items-baseline gap-1.5 text-xs">
        <span className="font-semibold" style={{ color: team.color }}>
          {team.abbrev}
        </span>
        <span className="font-medium text-white/90">Batters</span>
      </div>
      <div className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(6,minmax(1.6rem,1fr))] gap-x-1.5 border-b border-white/[0.08] pb-1.5 text-[9px] tracking-wide text-white/40">
        <span>Player</span>
        {BATTER_COLS.map((col) => (
          <span key={col} className="text-right uppercase">
            {col}
          </span>
        ))}
      </div>
      <ul>
        {batters.map((batter) => (
          <li
            key={`${team.id}-${batter.name}-${batter.order ?? ""}`}
            className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(6,minmax(1.6rem,1fr))] gap-x-1.5 border-b border-white/[0.06] py-1.5 text-[11px]"
          >
            <span className="truncate text-white">
              {batter.name}
              {batter.position ? (
                <span className="ml-1 text-white/40">{batter.position}</span>
              ) : null}
            </span>
            {batterValues(batter).map((value, index) => (
              <span
                key={`${batter.name}-${BATTER_COLS[index]}`}
                className="text-right tabular-nums text-white/85"
              >
                {value}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PitcherTable({
  team,
  pitchers,
}: {
  team: MlbGameDetailTeam;
  pitchers: MlbPitcherRow[];
}) {
  if (pitchers.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <div className="mb-1.5 flex items-baseline gap-1.5 text-xs">
        <span className="font-semibold" style={{ color: team.color }}>
          {team.abbrev}
        </span>
        <span className="font-medium text-white/90">Pitchers</span>
      </div>
      <div className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(7,minmax(1.6rem,1fr))] gap-x-1.5 border-b border-white/[0.08] pb-1.5 text-[9px] tracking-wide text-white/40">
        <span>Pitcher</span>
        {PITCHER_COLS.map((col) => (
          <span key={col} className="text-right uppercase">
            {col}
          </span>
        ))}
      </div>
      <ul>
        {pitchers.map((pitcher) => (
          <li
            key={`${team.id}-${pitcher.name}`}
            className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(7,minmax(1.6rem,1fr))] gap-x-1.5 border-b border-white/[0.06] py-1.5 text-[11px]"
          >
            <span className="truncate text-white">{pitcher.name}</span>
            {pitcherValues(pitcher).map((value, index) => (
              <span
                key={`${pitcher.name}-${PITCHER_COLS[index]}`}
                className="text-right tabular-nums text-white/85"
              >
                {value}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MlbBoxScore({ detail }: { detail: MlbGameDetailView }) {
  const box = detail.boxScore;
  if (!box) return null;

  const hasBatters =
    box.awayBatters.length > 0 || box.homeBatters.length > 0;
  const hasPitchers =
    box.awayPitchers.length > 0 || box.homePitchers.length > 0;
  if (!hasBatters && !hasPitchers) return null;

  return (
    <GameSection className="!p-3 space-y-5" data-testid="mlb-box-score">
      <h2 className="text-sm font-semibold text-white">Box score</h2>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <BatterTable team={detail.away} batters={box.awayBatters} />
          <PitcherTable team={detail.away} pitchers={box.awayPitchers} />
        </div>
        <div className="space-y-4">
          <BatterTable team={detail.home} batters={box.homeBatters} />
          <PitcherTable team={detail.home} pitchers={box.homePitchers} />
        </div>
      </div>
    </GameSection>
  );
}
