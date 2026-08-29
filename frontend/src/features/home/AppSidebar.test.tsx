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

function homeRowLink(name: string) {
  return screen
    .getAllByRole("link", { name })
    .find((link) => link.querySelector("svg"));
}

describe("AppSidebar", () => {
  beforeEach(() => {
    prefetchPropsBoard.mockReset();
  });

  it("labels primary nav, links Home to /, and lists About, Blog, and Settings", () => {
    renderSidebar("/");
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass(
      "font-semibold",
    );
    expect(screen.getByRole("link", { name: "statvista" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "statvista" }).parentElement).toHaveClass(
      CHROME_TITLE_TOP,
    );
    expect(
      screen.getByRole("navigation", { name: "Primary" }).firstElementChild,
    ).toHaveClass("rounded-2xl", "bg-[#1e1e1e]", "px-[13px]", "py-[9px]");

    const siteNav = screen.getByRole("navigation", { name: "Site" });
    expect(
      screen.getByRole("navigation", { name: "Primary" }).nextElementSibling,
    ).toBe(siteNav);
    expect(siteNav).toHaveClass("rounded-2xl", "bg-[#1e1e1e]");
    expect(within(siteNav).getByRole("button", { name: "About" })).toHaveClass(
      "font-semibold",
    );
    expect(within(siteNav).getByRole("button", { name: "Blog" })).toBeInTheDocument();
    expect(
      within(siteNav).getByRole("button", { name: "Settings" }),
    ).toBeInTheDocument();
    const homeRow = screen.getByRole("link", { name: "Home" }).parentElement;
    expect(homeRow).toContainElement(
      screen.getByRole("button", { name: "Toggle leagues" }),
    );
    expect(screen.getByRole("link", { name: "Props" })).toHaveAttribute(
      "href",
      "/mlb/prop_picks",
    );
    expect(screen.getByRole("link", { name: "Props" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Props" }).parentElement).not.toHaveClass(
      "pl-[13px]",
    );
    expect(homeRowLink("Legs")).toHaveAttribute("href", "/mlb/legs");
    expect(homeRowLink("Legs")).not.toHaveAttribute("aria-current");
    expect(homeRowLink("Legs")?.parentElement).not.toHaveClass("pl-[13px]");
    expect(homeRowLink("Matchups")).toHaveAttribute("href", "/mlb/matchups");
    expect(homeRowLink("Matchups")).not.toHaveAttribute("aria-current");
    expect(homeRowLink("Matchups")?.parentElement).not.toHaveClass("pl-[13px]");
  });

  it("points league links at matchups hubs with official logos", () => {
    renderSidebar("/");
    expect(screen.getByRole("link", { name: "NBA" })).toHaveAttribute(
      "href",
      "/nba/matchups",
    );
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(screen.getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    const images = document.querySelectorAll('nav img[aria-hidden="true"]');
    expect(images).toHaveLength(3);
    expect(images[0]?.getAttribute("src")).toMatch(/nba_logo/);
    expect(images[1]?.getAttribute("src")).toMatch(/wnba_logo/);
    expect(images[2]?.getAttribute("src")).toBe(
      "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
    );
  });

  it("does not nest sections on home", () => {
    renderSidebar("/");
    expect(screen.queryByText("Explore")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WNBA" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(homeRowLink("Matchups")).toHaveAttribute("href", "/mlb/matchups");
  });

  it("nests WNBA sections only under WNBA and marks the current section", () => {
    renderSidebar("/wnba/standings");
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "NBA" })).not.toHaveAttribute(
      "aria-current",
    );
    const standings = screen.getByRole("link", { name: "Standings" });
    expect(standings).toHaveAttribute("href", "/wnba/standings");
    expect(standings).toHaveAttribute("aria-current", "page");
    expect(homeRowLink("Matchups")).toHaveAttribute("href", "/wnba/matchups");
    const nestedMatchups = screen
      .getAllByRole("link", { name: "Matchups" })
      .find((link) => !link.querySelector("svg"));
    expect(nestedMatchups).toHaveAttribute("href", "/wnba/matchups");
    expect(screen.queryByRole("link", { name: "MLB Chatbot" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WNBA Chatbot" })).toHaveAttribute(
      "href",
      "/wnba/chatbot",
    );
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Learn")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Legs" }).every((link) =>
        Boolean(link.querySelector("svg")),
      ),
    ).toBe(true);
  });

  it("treats /games/:id as WNBA and does not add a game row", () => {
    renderSidebar("/games/401857098");
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(homeRowLink("Matchups")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Game" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("points the Home Props, Legs, and Matchups shortcuts at the current league", () => {
    renderSidebar("/wnba/standings");
    const homeProps = homeRowLink("Props");
    expect(homeProps).toHaveAttribute("href", "/wnba/prop_picks");
    expect(homeRowLink("Legs")).toHaveAttribute("href", "/wnba/legs");
    expect(homeRowLink("Matchups")).toHaveAttribute("href", "/wnba/matchups");
  });

  it("places Props, Legs, and Matchups after the league tree so expanding Home pushes them down", () => {
    renderSidebar("/");
    const home = screen.getByRole("link", { name: "Home" });
    const mlb = screen.getByRole("link", { name: "MLB" });
    const props = screen.getByRole("link", { name: "Props" });
    const legs = homeRowLink("Legs");
    const matchups = homeRowLink("Matchups");
    expect(home.compareDocumentPosition(mlb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mlb.compareDocumentPosition(props) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      legs &&
        (props.compareDocumentPosition(legs) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBeTruthy();
    expect(
      matchups &&
        legs &&
        (legs.compareDocumentPosition(matchups) &
          Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBeTruthy();
  });

  it("keeps NBA placeholder items disabled and omits EV+", () => {
    renderSidebar("/nba/matchups");
    expect(screen.getByRole("link", { name: "Props" })).toHaveAttribute(
      "href",
      "/mlb/prop_picks",
    );
    expect(homeRowLink("Matchups")).toHaveAttribute("href", "/nba/matchups");
    expect(homeRowLink("Matchups")).toHaveAttribute("aria-current", "page");
    expect(homeRowLink("Legs")).toHaveAttribute("href", "/mlb/legs");
    expect(screen.getByRole("button", { name: "Leaders" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Props" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Playoff race" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "EV+" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Arbitrage" })).not.toBeInTheDocument();
  });

  it("collapses leagues when the Home chevron is toggled", async () => {
    const user = userEvent.setup();
    renderSidebar("/mlb/leaders");
    expect(screen.getByRole("link", { name: "MLB" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leaders" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const toggle = screen.getByRole("button", { name: "Toggle leagues" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "MLB" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Leaders" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Props" })).toHaveAttribute(
      "href",
      "/mlb/prop_picks",
    );
    expect(homeRowLink("Matchups")).toHaveAttribute("href", "/mlb/matchups");
  });

  it("prefetches the home Props board on mount and again on hover", async () => {
    const user = userEvent.setup();
    renderSidebar("/");
    expect(prefetchPropsBoard).toHaveBeenCalledWith(
      expect.anything(),
      "/mlb/prop_picks",
    );
    const idleCalls = prefetchPropsBoard.mock.calls.length;
    const homeProps = homeRowLink("Props");
    expect(homeProps).toBeDefined();
    if (!homeProps) return;
    await user.hover(homeProps);
    expect(prefetchPropsBoard.mock.calls.length).toBeGreaterThan(idleCalls);
    expect(prefetchPropsBoard).toHaveBeenLastCalledWith(
      expect.anything(),
      "/mlb/prop_picks",
    );
  });

  it("prefetches the current league board from WNBA", () => {
    renderSidebar("/wnba/standings");
    expect(prefetchPropsBoard).toHaveBeenCalledWith(
      expect.anything(),
      "/wnba/prop_picks",
    );
  });
});
