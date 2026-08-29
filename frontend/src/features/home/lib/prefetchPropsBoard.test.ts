import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { prefetchPropsBoard } from "./prefetchPropsBoard";

const prefetchMlbPropBoard = vi.fn();
const prefetchWnbaDefaultProps = vi.fn();

vi.mock("@/features/mlb/hooks/useMlbPropBoard", () => ({
  prefetchMlbPropBoard: (...args: unknown[]) => prefetchMlbPropBoard(...args),
}));

vi.mock("@/features/basketball/hooks/useWnbaProps", () => ({
  prefetchWnbaDefaultProps: (...args: unknown[]) =>
    prefetchWnbaDefaultProps(...args),
}));

describe("prefetchPropsBoard", () => {
  beforeEach(() => {
    prefetchMlbPropBoard.mockReset();
    prefetchWnbaDefaultProps.mockReset();
  });

  it("prefetches the MLB board for /mlb/prop_picks", () => {
    const client = new QueryClient();
    prefetchPropsBoard(client, "/mlb/prop_picks");
    expect(prefetchMlbPropBoard).toHaveBeenCalledWith(client);
    expect(prefetchWnbaDefaultProps).not.toHaveBeenCalled();
  });

  it("prefetches the default WNBA board for /wnba/prop_picks", () => {
    const client = new QueryClient();
    prefetchPropsBoard(client, "/wnba/prop_picks");
    expect(prefetchWnbaDefaultProps).toHaveBeenCalledWith(client);
    expect(prefetchMlbPropBoard).not.toHaveBeenCalled();
  });

  it("does nothing for matchups hrefs", () => {
    const client = new QueryClient();
    prefetchPropsBoard(client, "/mlb/matchups");
    expect(prefetchMlbPropBoard).not.toHaveBeenCalled();
    expect(prefetchWnbaDefaultProps).not.toHaveBeenCalled();
  });
});
