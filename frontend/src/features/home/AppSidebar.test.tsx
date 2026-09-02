import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppSidebar } from "./AppSidebar";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";

const { prefetchPropsBoard } = vi.hoisted(() => ({
  prefetchPropsBoard: vi.fn(),
}));

vi.mock("./lib/prefetchPropsBoard", () => ({
  prefetchPropsBoard,
}));

function renderSidebar(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    prefetchPropsBoard.mockReset();
  });

  it("lists Home with league fold, then Props, Legs, Arbitrage, Games, and Site", () => {
    renderSidebar("/mlb/matchups");
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    expect(screen.getByRole("button", { name: "Hide leagues" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    expect(screen.getByRole("link", { name: "MLB" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(screen.getByRole("link", { name: "NBA" })).toHaveAttribute(
      "href",
      "/nba/matchups",
    );
    expect(screen.queryByText("Explore")).not.toBeInTheDocument();
    expect(screen.queryByText("Learn")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "statvista" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    expect(screen.getByRole("link", { name: "statvista" }).parentElement).toHaveClass(
      CHROME_TITLE_TOP,
    );
    expect(screen.getByRole("link", { name: "statvista" })).toHaveClass(
      "chrome-title-row",
    );
    expect(
      screen.getByRole("navigation", { name: "Primary" }).firstElementChild,
    ).toHaveClass("nav-panel");

    const siteNav = screen.getByRole("navigation", { name: "Site" });
    expect(
      screen.getByRole("navigation", { name: "Primary" }).nextElementSibling,
    ).toBe(siteNav);
    expect(siteNav).toHaveClass("nav-panel");
    expect(within(siteNav).getByRole("button", { name: "About" })).toHaveClass(
      "nav-link",
    );
    expect(within(siteNav).getByRole("button", { name: "Blog" })).toBeInTheDocument();
    expect(
      within(siteNav).getByRole("button", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Props" })).toHaveAttribute(
      "href",
      "/mlb/prop_picks",
    );
    expect(screen.getByRole("link", { name: "Props" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Legs" })).toHaveAttribute(
      "href",
      "/mlb/legs",
    );
    expect(screen.getByRole("link", { name: "Arbitrage" })).toHaveAttribute(
      "href",
      "/mlb/arbitrage",
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("collapses the Home league list from the chevron", async () => {
    const user = userEvent.setup();
    renderSidebar("/mlb/matchups");
    await user.click(screen.getByRole("button", { name: "Hide leagues" }));
    expect(screen.getByRole("button", { name: "Show leagues" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("link", { name: "MLB" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "WNBA" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "NBA" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("does not nest Leaders, Standings, Futures, or chatbots", () => {
    renderSidebar("/wnba/matchups");
    expect(screen.queryByRole("link", { name: "Leaders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Standings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Futures" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "WNBA Chatbot" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "MLB Chatbot" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "EV+" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Playoff race" }),
    ).not.toBeInTheDocument();
  });

  it("treats /games/:id as WNBA for shortcuts and does not add a game row", () => {
    renderSidebar("/games/401857098");
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("link", { name: /^Game$/ })).not.toBeInTheDocument();
  });

  it("points Props, Legs, Arbitrage, and Games at the current league", () => {
    renderSidebar("/wnba/matchups");
    expect(screen.getByRole("link", { name: "Props" })).toHaveAttribute(
      "href",
      "/wnba/prop_picks",
    );
    expect(screen.getByRole("link", { name: "Legs" })).toHaveAttribute(
      "href",
      "/wnba/legs",
    );
    expect(screen.getByRole("link", { name: "Arbitrage" })).toHaveAttribute(
      "href",
      "/wnba/arbitrage",
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("places Home, leagues, then Props, Legs, Arbitrage, then Games", () => {
    renderSidebar("/mlb/matchups");
    const home = screen.getByRole("link", { name: "Home" });
    const mlb = screen.getByRole("link", { name: "MLB" });
    const wnba = screen.getByRole("link", { name: "WNBA" });
    const nba = screen.getByRole("link", { name: "NBA" });
    const props = screen.getByRole("link", { name: "Props" });
    const legs = screen.getByRole("link", { name: "Legs" });
    const arbitrage = screen.getByRole("link", { name: "Arbitrage" });
    const matchups = screen.getByRole("link", { name: "Games" });
    expect(home.compareDocumentPosition(mlb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mlb.compareDocumentPosition(wnba) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(wnba.compareDocumentPosition(nba) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nba.compareDocumentPosition(props) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(props.compareDocumentPosition(legs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      legs.compareDocumentPosition(arbitrage) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      arbitrage.compareDocumentPosition(matchups) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("falls NBA Props, Legs, and Arbitrage back to MLB", () => {
    renderSidebar("/nba/matchups");
    expect(screen.getByRole("link", { name: "Props" })).toHaveAttribute(
      "href",
      "/mlb/prop_picks",
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "href",
      "/nba/matchups",
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Legs" })).toHaveAttribute(
      "href",
      "/mlb/legs",
    );
    expect(screen.getByRole("link", { name: "Arbitrage" })).toHaveAttribute(
      "href",
      "/mlb/arbitrage",
    );
  });

  it("prefetches the Props board on mount and again on hover", async () => {
    const user = userEvent.setup();
    renderSidebar("/mlb/matchups");
    expect(prefetchPropsBoard).toHaveBeenCalledWith(
      expect.anything(),
      "/mlb/prop_picks",
    );
    const idleCalls = prefetchPropsBoard.mock.calls.length;
    await user.hover(screen.getByRole("link", { name: "Props" }));
    expect(prefetchPropsBoard.mock.calls.length).toBeGreaterThan(idleCalls);
    expect(prefetchPropsBoard).toHaveBeenLastCalledWith(
      expect.anything(),
      "/mlb/prop_picks",
    );
  });

  it("prefetches the current league board from WNBA", () => {
    renderSidebar("/wnba/matchups");
    expect(prefetchPropsBoard).toHaveBeenCalledWith(
      expect.anything(),
      "/wnba/prop_picks",
    );
  });
});
