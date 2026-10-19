import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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

function svgMarkup(name: string, role: "link" | "button" = "link"): string {
  const el = screen.getByRole(role, { name });
  const svg = el.querySelector("svg");
  if (!svg) {
    throw new Error(`expected an icon on ${role} "${name}"`);
  }
  return svg.innerHTML;
}

describe("AppSidebar", () => {
  beforeEach(() => {
    prefetchPropsBoard.mockReset();
  });

  it("lists Props and Games, then Site links", () => {
    renderSidebar("/mlb/matchups");
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /leagues/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "MLB" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "WNBA" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "NBA" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "statvista" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    expect(screen.getByRole("link", { name: "statvista" }).parentElement).toHaveClass(
      CHROME_TITLE_TOP,
    );
    expect(
      screen.getByRole("navigation", { name: "Primary" }).firstElementChild,
    ).toHaveClass("nav-panel");
    expect(screen.getByRole("link", { name: "Props" })).toHaveAttribute(
      "href",
      "/mlb/prop_picks",
    );
    expect(screen.queryByRole("link", { name: "Legs" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Arbitrage" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const siteNav = screen.getByRole("navigation", { name: "Site" });
    expect(
      screen.getByRole("navigation", { name: "Primary" }).nextElementSibling,
    ).toBe(siteNav);
    expect(siteNav).toHaveClass("nav-panel");
    expect(within(siteNav).getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(within(siteNav).getByRole("link", { name: "Blog" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(
      within(siteNav).getByRole("link", { name: "Contact" }),
    ).toHaveAttribute("href", "/contact");
  });

  it("marks About current on /about", () => {
    renderSidebar("/about");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Contact current on /contact", () => {
    renderSidebar("/contact");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Blog current on /blog and a post", () => {
    renderSidebar("/blog");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    cleanup();
    renderSidebar("/blog/when-analytics-lie-2026-knicks");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("uses the previous Lucide shapes for Props, Games, Blog, and Contact", () => {
    renderSidebar("/mlb/matchups");
    expect(svgMarkup("Props")).toContain("M14 4h7");
    expect(svgMarkup("Games")).toContain("M8 2v4");
    expect(svgMarkup("Blog")).toContain("M15 18h-5");
    expect(svgMarkup("Contact")).toContain("m22 7-8.991");
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
    expect(screen.queryByRole("link", { name: /^Game$/ })).not.toBeInTheDocument();
  });

  it("points Props and Games at the current league", () => {
    renderSidebar("/wnba/matchups");
    expect(screen.getByRole("link", { name: "Props" })).toHaveAttribute(
      "href",
      "/wnba/prop_picks",
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
  });

  it("places Props then Games", () => {
    renderSidebar("/mlb/matchups");
    const props = screen.getByRole("link", { name: "Props" });
    const matchups = screen.getByRole("link", { name: "Games" });
    expect(
      props.compareDocumentPosition(matchups) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("points NBA Props at the NBA board while Games stay on NBA", () => {
    renderSidebar("/nba/matchups");
    expect(screen.getByRole("link", { name: "Props" })).toHaveAttribute(
      "href",
      "/nba/prop_picks",
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "href",
      "/nba/matchups",
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "aria-current",
      "page",
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
