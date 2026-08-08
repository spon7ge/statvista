import type { ApiMlbFuturesMarket } from "@/shared/lib/api";
import { TeamAbbrevAvatar } from "@/shared/ui/TeamAbbrevAvatar";
import {
  FUTURES_GROUP_TABS,
  filterMarketsByGroup,
  type FuturesGroupId,
} from "./mlbFuturesGroups";

type MlbFuturesBoardProps = {
  markets: ApiMlbFuturesMarket[];
  group: FuturesGroupId;
  onGroupChange: (group: FuturesGroupId) => void;
  isLoading?: boolean;
  isError?: boolean;
};

function Skeletons() {
  return (
    <div aria-label="Loading futures">
      <div className="h-40 animate-pulse rounded-xl border border-white/10 bg-white/[0.03] sm:h-48" />
    </div>
  );
}

function MarketBlock({ market }: { market: ApiMlbFuturesMarket }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-white sm:text-base">
          {market.display_name}
        </h3>
        <p className="text-[11px] text-white/40 sm:text-xs">
          Odds by <span className="text-white/55">{market.provider}</span>
        </p>
      </div>
      {market.entries.length === 0 ? (
        <p className="text-sm text-white/40">No futures listed</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-8 gap-y-0.5 sm:grid-cols-2">
          {market.entries.map((entry) => (
            <li
              key={`${market.id}-${entry.team_id}`}
              className="flex items-center justify-between gap-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <TeamAbbrevAvatar
                  abbrev={entry.abbrev}
                  logoUrl={entry.logo_url}
                  sizeClassName="size-6"
                />
                <span className="truncate text-xs text-white/85 sm:text-sm">
                  {entry.name}
                </span>
              </div>
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-white sm:text-sm">
                {entry.odds_american}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MlbFuturesBoard({
  markets,
  group,
  onGroupChange,
  isLoading = false,
  isError = false,
}: MlbFuturesBoardProps) {
  const filteredMarkets = filterMarketsByGroup(markets, group);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div
        role="tablist"
        aria-label="Futures group"
        className="flex items-center justify-center gap-1 border-b border-white/10"
      >
        {FUTURES_GROUP_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`mlb-futures-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={group === tab.id}
            aria-controls={`mlb-futures-${tab.id}-panel`}
            className={`border-b-2 px-5 py-2 text-[18px] font-medium transition-colors ${
              group === tab.id
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
            onClick={() => onGroupChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`mlb-futures-${group}-panel`}
        role="tabpanel"
        aria-labelledby={`mlb-futures-${group}-tab`}
      >
        {isLoading ? (
          <Skeletons />
        ) : isError ? (
          <p className="text-sm text-white/40">Unable to load futures</p>
        ) : markets.length === 0 ? (
          <p className="text-sm text-white/40">No futures listed</p>
        ) : filteredMarkets.length === 0 ? (
          <p className="text-sm text-white/40">No futures in this group</p>
        ) : (
          <div className="space-y-3">
            {filteredMarkets.map((market) => (
              <MarketBlock key={market.id} market={market} />
            ))}
          </div>
        )}
      </div>

      <p className="text-[14px] text-white/35">Data: ESPN</p>
    </section>
  );
}
