import type { ApiMlbFuturesMarket } from "@/shared/lib/api";

export type FuturesGroupId = "world_series" | "league" | "division";

export const FUTURES_GROUP_TABS: { id: FuturesGroupId; label: string }[] = [
  { id: "world_series", label: "World Series" },
  { id: "league", label: "League" },
  { id: "division", label: "Division" },
];

function marketSearchText(market: ApiMlbFuturesMarket): string {
  return `${market.display_name} ${market.name}`.toLowerCase();
}

export function marketMatchesGroup(
  market: ApiMlbFuturesMarket,
  group: FuturesGroupId,
): boolean {
  const text = marketSearchText(market);

  if (group === "world_series") {
    return text.includes("world series");
  }

  if (group === "division") {
    return text.includes("division");
  }

  const isLeagueMarket =
    text.includes("american league winner") ||
    text.includes("national league winner") ||
    text.includes("winning league");

  return isLeagueMarket && !text.includes("division");
}

export function filterMarketsByGroup(
  markets: ApiMlbFuturesMarket[],
  group: FuturesGroupId,
): ApiMlbFuturesMarket[] {
  return markets.filter((market) => marketMatchesGroup(market, group));
}
