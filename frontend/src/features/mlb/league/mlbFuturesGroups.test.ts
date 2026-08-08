import { describe, expect, it } from "vitest";
import type { ApiMlbFuturesMarket } from "@/shared/lib/api";
import {
  filterMarketsByGroup,
  marketMatchesGroup,
} from "./mlbFuturesGroups";

function market(
  partial: Partial<ApiMlbFuturesMarket> &
    Pick<ApiMlbFuturesMarket, "id" | "display_name" | "name">,
): ApiMlbFuturesMarket {
  return {
    provider: "DraftKings",
    entries: [],
    ...partial,
  };
}

const ws = market({
  id: "2761",
  name: "MLB  - World Series - Winner",
  display_name: "World Series Winner",
});

const al = market({
  id: "2762",
  name: "MLB - American League Winner",
  display_name: "American League Winner",
});

const nlEast = market({
  id: "2763",
  name: "MLB - National League East Division Winner",
  display_name: "NL East Division Winner",
});

const winningLeague = market({
  id: "2764",
  name: "MLB - Winning League",
  display_name: "Winning League",
});

describe("mlbFuturesGroups", () => {
  it("classifies world series / league / division markets", () => {
    expect(marketMatchesGroup(ws, "world_series")).toBe(true);
    expect(marketMatchesGroup(al, "league")).toBe(true);
    expect(marketMatchesGroup(winningLeague, "league")).toBe(true);
    expect(marketMatchesGroup(nlEast, "division")).toBe(true);
    expect(marketMatchesGroup(nlEast, "league")).toBe(false);
    expect(marketMatchesGroup(ws, "league")).toBe(false);
    expect(marketMatchesGroup(al, "division")).toBe(false);
  });

  it("filters markets by group", () => {
    const markets = [ws, al, nlEast, winningLeague];
    expect(filterMarketsByGroup(markets, "world_series")).toEqual([ws]);
    expect(filterMarketsByGroup(markets, "league")).toEqual([al, winningLeague]);
    expect(filterMarketsByGroup(markets, "division")).toEqual([nlEast]);
  });
});
