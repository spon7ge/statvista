import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LeagueSectionSwitcher } from "./LeagueSectionSwitcher";

const { prefetchPropsBoard } = vi.hoisted(() => ({
  prefetchPropsBoard: vi.fn(),
}));

vi.mock("./lib/prefetchPropsBoard", () => ({
  prefetchPropsBoard,
}));

function renderSwitcher(
  path: string,
  section: "Props" | "Games" | "Legs" | "Arbitrage",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <LeagueSectionSwitcher section={section} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeagueSectionSwitcher", () => {
  beforeEach(() => {
    prefetchPropsBoard.mockReset();
  });

  it("marks MLB current on the MLB board and links WNBA props", () => {
    renderSwitcher("/mlb/prop_picks", "Props");
    const leagues = screen.getByRole("navigation", { name: "Leagues" });
    expect(within(leagues).getByRole("link", { name: "MLB" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(leagues).getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/prop_picks",
    );
    expect(within(leagues).getByRole("button", { name: "NBA" })).toBeDisabled();
  });

  it("links all three leagues on matchups, including NBA", () => {
    renderSwitcher("/wnba/matchups", "Games");
    const leagues = screen.getByRole("navigation", { name: "Leagues" });
    expect(within(leagues).getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(leagues).getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    expect(within(leagues).getByRole("link", { name: "NBA" })).toHaveAttribute(
      "href",
      "/nba/matchups",
    );
    expect(
      within(leagues).queryByRole("button", { name: "NBA" }),
    ).not.toBeInTheDocument();
  });

  it("links MLB and WNBA on Legs and disables NBA", () => {
    renderSwitcher("/mlb/legs", "Legs");
    const leagues = screen.getByRole("navigation", { name: "Leagues" });
    expect(within(leagues).getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/legs",
    );
    expect(within(leagues).getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/legs",
    );
    expect(within(leagues).getByRole("button", { name: "NBA" })).toBeDisabled();
  });

  it("links MLB and WNBA on Arbitrage and disables NBA", () => {
    renderSwitcher("/mlb/arbitrage", "Arbitrage");
    const leagues = screen.getByRole("navigation", { name: "Leagues" });
    expect(within(leagues).getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/arbitrage",
    );
    expect(within(leagues).getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/arbitrage",
    );
    expect(within(leagues).getByRole("button", { name: "NBA" })).toBeDisabled();
  });

  it("prefetches the other league board when hovering a Props pill", async () => {
    const user = userEvent.setup();
    renderSwitcher("/mlb/prop_picks", "Props");
    const wnba = screen.getByRole("link", { name: "WNBA" });
    await user.hover(wnba);
    expect(prefetchPropsBoard).toHaveBeenCalledWith(
      expect.anything(),
      "/wnba/prop_picks",
    );
  });

  it("does not prefetch on Games pills", async () => {
    const user = userEvent.setup();
    renderSwitcher("/mlb/matchups", "Games");
    await user.hover(screen.getByRole("link", { name: "WNBA" }));
    expect(prefetchPropsBoard).not.toHaveBeenCalled();
  });
});
