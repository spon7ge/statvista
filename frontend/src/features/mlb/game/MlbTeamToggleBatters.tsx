import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type {
  MlbBatterRow,
  MlbGameDetailTeam,
  MlbGameDetailView,
} from "../lib/types";

const COLS = ["AB", "R", "H", "RBI", "HR", "SB", "BB", "K"] as const;

type TeamSide = "away" | "home";

function shortTeamName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function defaultSide(detail: MlbGameDetailView): TeamSide {
  const half = detail.linescore?.inningHalf;
  if (half === "bottom") return "home";
  return "away";
}

function batterValues(row: MlbBatterRow): Array<string | number> {
  return [
    row.ab ?? "–",
    row.r ?? "–",
    row.h ?? "–",
    row.rbi ?? "–",
    row.hr ?? "–",
    row.sb ?? "–",
    row.bb ?? "–",
    row.so ?? "–",
  ];
}

function BattersTable({
  team,
  batters,
}: {
  team: MlbGameDetailTeam;
  batters: MlbBatterRow[];
}) {
  if (batters.length === 0) {
    return <p className="text-xs text-white/50">No batters yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(8,minmax(1.6rem,1fr))] gap-x-1.5 border-b border-white/[0.08] pb-1.5 text-[9px] tracking-wide text-white/40">
        <span>Player</span>
        {COLS.map((col) => (
          <span key={col} className="text-right uppercase">
            {col}
          </span>
        ))}
      </div>
      <ul>
        {batters.map((batter) => (
          <li
            key={`${team.id}-${batter.name}-${batter.order ?? ""}`}
            className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(8,minmax(1.6rem,1fr))] gap-x-1.5 border-b border-white/[0.06] py-1.5 text-[11px]"
          >
            <span className="truncate text-white">
              {batter.name}
              {batter.position ? (
                <span className="ml-1 text-white/40">{batter.position}</span>
              ) : null}
            </span>
            {batterValues(batter).map((value, index) => (
              <span
                key={`${batter.name}-${COLS[index]}`}
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

export function MlbTeamToggleBatters({ detail }: { detail: MlbGameDetailView }) {
  // Must run before early returns so poll null→boxScore transitions stay hook-stable.
  const [side, setSide] = useState<TeamSide>(() => defaultSide(detail));

  const box = detail.boxScore;
  if (!box) return null;

  const hasBatters =
    box.awayBatters.length > 0 || box.homeBatters.length > 0;
  if (!hasBatters) return null;

  const awayLabel = shortTeamName(detail.away.name);
  const homeLabel = shortTeamName(detail.home.name);
  const activeTeam = side === "away" ? detail.away : detail.home;
  const batters = side === "away" ? box.awayBatters : box.homeBatters;

  return (
    <GameSection className="!p-3" data-testid="mlb-team-toggle-batters">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Batters</h2>
        <div className="flex flex-wrap items-center gap-0.5">
          {(
            [
              { key: "away" as const, label: awayLabel },
              { key: "home" as const, label: homeLabel },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSide(key)}
              aria-pressed={side === key}
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                side === key
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <BattersTable team={activeTeam} batters={batters} />
    </GameSection>
  );
}
