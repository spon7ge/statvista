import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import { mlbTeamLogoUrl } from "../league/mlbTeamLogos";
import type {
  MlbGameDetailView,
  MlbMatchupLeaderCategory,
} from "../lib/types";

type CategoryKey = MlbMatchupLeaderCategory["key"];

const TAB_ORDER: CategoryKey[] = ["hr", "avg", "ops", "era", "so", "whip"];

export function MlbMatchupLeaders({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  const payload = detail.matchupLeaders;
  const [activeKey, setActiveKey] = useState<CategoryKey>("hr");
  if (!payload) return null;

  const category =
    payload.categories.find((c) => c.key === activeKey) ??
    payload.categories[0];
  if (!category) return null;

  return (
    <GameSection data-testid="mlb-matchup-leaders" className="w-full !p-3">
      <h2 className="text-center text-[18px] font-semibold text-white">
        Matchup Leaders
      </h2>
      <div
        className="mt-3 flex flex-wrap justify-center gap-1"
        role="tablist"
        aria-label="Matchup leader categories"
      >
        {TAB_ORDER.map((key) => {
          const label =
            payload.categories.find((c) => c.key === key)?.label ?? key.toUpperCase();
          const selected = category.key === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`mlb-matchup-leaders-tab-${key}`}
              className={`px-2 py-1 text-[14px] ${
                selected ? "text-white" : "text-white/45"
              }`}
              onClick={() => setActiveKey(key)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {category.leaders.length === 0 ? (
        <p className="mt-3 text-center text-[18px] text-white/50">
          No top leaders on either roster.
        </p>
      ) : (
        <ul className="mt-3 space-y-2" data-testid="mlb-matchup-leaders-list">
          {category.leaders.map((entry) => {
            const team = entry.side === "away" ? detail.away : detail.home;
            const logo = team.logoUrl ?? mlbTeamLogoUrl(team.abbrev);
            return (
              <li
                key={`${entry.playerId}-${entry.rank}`}
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 text-[18px] text-white/85"
                data-testid={`mlb-matchup-leader-${entry.playerId}`}
              >
                <span className="font-mono text-white/45">{`#${entry.rank}`}</span>
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {logo ? (
                    <img src={logo} alt="" className="size-5 object-contain" />
                  ) : null}
                  <span className="truncate">{entry.name}</span>
                  <span className="text-white/45">{entry.teamAbbrev}</span>
                </span>
                <span className="font-mono tabular-nums">{entry.value}</span>
              </li>
            );
          })}
        </ul>
      )}
    </GameSection>
  );
}
