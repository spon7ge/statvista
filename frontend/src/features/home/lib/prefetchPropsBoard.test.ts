import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { prefetchPropsBoard } from "./prefetchPropsBoard";

const prefetchMlbPropBoard = vi.fn();
const prefetchWnbaPropBoard = vi.fn();

vi.mock("@/features/mlb/hooks/useMlbPropBoard", () => ({
  prefetchMlbPropBoard: (...args: unknown[]) => prefetchMlbPropBoard(...args),
}));

vi.mock("@/features/basketball/hooks/useWnbaPropBoard", () => ({
  prefetchWnbaPropBoard: (...args: unknown[]) => prefetchWnbaPropBoard(...args),
}));

describe("prefetchPropsBoard", () => {
  beforeEach(() => {
    prefetchMlbPropBoard.mockReset();
    prefetchWnbaPropBoard.mockReset();
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
  });

  it("does nothing for matchups hrefs", () => {
    const client = new QueryClient();
    prefetchPropsBoard(client, "/mlb/matchups");
    expect(prefetchMlbPropBoard).not.toHaveBeenCalled();
    expect(prefetchWnbaPropBoard).not.toHaveBeenCalled();
  });
});
