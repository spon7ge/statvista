import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

function renderSidebar(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppSidebar />
    </MemoryRouter>,
  );
}

describe("AppSidebar", () => {
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
    expect(screen.queryByRole("link", { name: "Matchups" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WNBA" })).not.toHaveAttribute(
      "aria-current",
    );
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
    expect(screen.getByRole("link", { name: "Matchups" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(screen.queryByRole("link", { name: "MLB Chatbot" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WNBA Chatbot" })).toHaveAttribute(
      "href",
      "/wnba/chatbot",
    );
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Learn")).toBeInTheDocument();
  });

  it("treats /games/:id as WNBA and does not add a game row", () => {
    renderSidebar("/games/401857098");
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Matchups" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Game" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps NBA placeholder items disabled and omits EV+", () => {
    renderSidebar("/nba/matchups");
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
  });
});
