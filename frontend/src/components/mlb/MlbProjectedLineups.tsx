import { useState } from "react";
import { GameSection } from "@/components/game/GameSection";
import type {
  ApiMlbLineupBatter,
  ApiMlbLineupGame,
  ApiMlbLineupSide,
} from "@/lib/api";
import type { MlbGameDetailTeam, MlbGameDetailView } from "./types";

type TeamSide = "away" | "home";

type Props = {
  detail: MlbGameDetailView;
  game: ApiMlbLineupGame | null;
  /** True while the lineups fetch is in flight and has no data yet. */
  isPending?: boolean;
};

function LogoToggleButton({
  team,
  side,
  active,
  onClick,
}: {
  team: MlbGameDetailTeam;
  side: TeamSide;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`mlb-lineup-toggle-${side}`}
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
        active ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
      }`}
    >
      {team.logoUrl ? (
        <img
          src={team.logoUrl}
          alt={team.abbrev}
          className="size-5 object-contain"
        />
      ) : (
        <span style={{ color: active ? undefined : team.color }}>
          {team.abbrev}
        </span>
      )}
    </button>
  );
}

function orderedBatters(batters: ApiMlbLineupBatter[]): ApiMlbLineupBatter[] {
  return [...batters].sort((a, b) => a.order - b.order);
}

function LineupSideList({ side }: { side: ApiMlbLineupSide }) {
  const batters = orderedBatters(side.batters);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-white/[0.08] pb-2 text-xs">
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
          SP
        </span>
        <span className="flex-1 truncate px-2 text-white">
          {side.pitcher.name ?? "TBD"}
        </span>
        <span className="text-white/50">
          {side.pitcher.hand ?? "–"}
          {side.pitcher.record ? ` · ${side.pitcher.record}` : ""}
          {side.pitcher.era ? ` · ${side.pitcher.era} ERA` : ""}
        </span>
      </div>
      {batters.length === 0 ? (
        <p className="text-xs text-white/50">No batters listed</p>
      ) : (
        <ul>
          {batters.map((batter) => (
            <li
              key={`${batter.order}-${batter.name ?? ""}`}
              className="flex items-center gap-2 border-b border-white/[0.06] py-1.5 text-xs last:border-b-0"
            >
              <span className="w-4 text-right text-white/40">
                {batter.order}
              </span>
              <span className="flex-1 truncate text-white">
                {batter.name ?? "TBD"}
              </span>
              <span className="text-white/50">
                {batter.position ?? "–"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MlbProjectedLineups({ detail, game, isPending }: Props) {
  const [side, setSide] = useState<TeamSide>("away");

  return (
    <GameSection className="!p-3" data-testid="mlb-projected-lineups">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          Projected lineups · RotoWire expected lineup
        </h2>
        <div className="flex items-center gap-1">
          <LogoToggleButton
            team={detail.away}
            side="away"
            active={side === "away"}
            onClick={() => setSide("away")}
          />
          <LogoToggleButton
            team={detail.home}
            side="home"
            active={side === "home"}
            onClick={() => setSide("home")}
          />
        </div>
      </div>
      {isPending ? (
        <p className="text-xs text-white/50">Loading lineups…</p>
      ) : !game ? (
        <p className="text-xs text-white/50">Lineups unavailable</p>
      ) : (
        <LineupSideList side={side === "away" ? game.away : game.home} />
      )}
    </GameSection>
  );
}
