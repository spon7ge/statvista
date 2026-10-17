import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { prefetchPropsBoard } from "./prefetchPropsBoard";

const prefetchMlbPropBoard = vi.fn();
const prefetchWnbaPropBoard = vi.fn();
const prefetchNbaPropBoard = vi.fn();

vi.mock("@/features/mlb/hooks/useMlbPropBoard", () => ({
  prefetchMlbPropBoard: (...args: unknown[]) => prefetchMlbPropBoard(...args),
}));

vi.mock("@/features/basketball/hooks/useWnbaPropBoard", () => ({
  prefetchWnbaPropBoard: (...args: unknown[]) => prefetchWnbaPropBoard(...args),
}));

vi.mock("@/features/nba/hooks/useNbaPropBoard", () => ({
  prefetchNbaPropBoard: (...args: unknown[]) => prefetchNbaPropBoard(...args),
}));

describe("prefetchPropsBoard", () => {
  beforeEach(() => {
    prefetchMlbPropBoard.mockReset();
    prefetchWnbaPropBoard.mockReset();
    prefetchNbaPropBoard.mockReset();
  });

  it("prefetches the MLB board for /mlb/prop_picks", () => {
    const client = new QueryClient();
    prefetchPropsBoard(client, "/mlb/prop_picks");
    expect(prefetchMlbPropBoard).toHaveBeenCalledWith(client);
    expect(prefetchWnbaPropBoard).not.toHaveBeenCalled();
  });

  it("prefetches the WNBA research board for /wnba/prop_picks", () => {
    const client = new QueryClient();
    prefetchPropsBoard(client, "/wnba/prop_picks");
    expect(prefetchWnbaPropBoard).toHaveBeenCalledWith(client);
    expect(prefetchMlbPropBoard).not.toHaveBeenCalled();
    expect(prefetchNbaPropBoard).not.toHaveBeenCalled();
  });

  it("prefetches the NBA board for /nba/prop_picks", () => {
    const client = new QueryClient();
    prefetchPropsBoard(client, "/nba/prop_picks");
    expect(prefetchNbaPropBoard).toHaveBeenCalledWith(client);
    expect(prefetchMlbPropBoard).not.toHaveBeenCalled();
    expect(prefetchWnbaPropBoard).not.toHaveBeenCalled();
  });

  it("does nothing for matchups hrefs", () => {
    const client = new QueryClient();
    prefetchPropsBoard(client, "/mlb/matchups");
    expect(prefetchMlbPropBoard).not.toHaveBeenCalled();
    expect(prefetchWnbaPropBoard).not.toHaveBeenCalled();
    expect(prefetchNbaPropBoard).not.toHaveBeenCalled();
  });
});
