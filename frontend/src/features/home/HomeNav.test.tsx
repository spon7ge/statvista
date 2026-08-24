import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HomeNav } from "./HomeNav";

function renderNav(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HomeNav />
    </MemoryRouter>,
  );
}

describe("HomeNav", () => {
  it("labels the primary nav and hides desktop league links on mobile", () => {
    renderNav("/");

    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NBA" }).parentElement).toHaveClass(
      "hidden",
      "sm:flex",
    );
    expect(
      screen.getByRole("button", { name: /^leagues$/i }).parentElement,
    ).toHaveClass("sm:hidden");
    expect(
      screen.queryByRole("link", { name: "About" }),
    ).not.toBeInTheDocument();
  });

  it("points league links at matchups hubs", () => {
    renderNav("/");
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
  });

  it("marks WNBA current on /wnba/matchups", () => {
    renderNav("/wnba/matchups");
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "NBA" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks NBA current on /nba/matchups", () => {
    renderNav("/nba/matchups");
    expect(screen.getByRole("link", { name: "NBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("uses official league logos in the nav", () => {
    const { container } = renderNav("/");
    const images = container.querySelectorAll('nav img[aria-hidden="true"]');
    expect(images).toHaveLength(3);
    expect(images[0]?.getAttribute("src")).toMatch(/nba_logo/);
    expect(images[1]?.getAttribute("src")).toMatch(/wnba_logo/);
    expect(images[2]?.getAttribute("src")).toBe(
      "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
    );
  });

  it("shows Leagues trigger on home and opens league links", async () => {
    const user = userEvent.setup();
    renderNav("/");

    const trigger = screen.getByRole("button", { name: /^leagues$/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const menu = screen.getByRole("menu", { name: "Leagues" });
    expect(menu).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "NBA" }),
    ).toHaveAttribute("href", "/nba/matchups");
    expect(
      screen.getByRole("menuitem", { name: "WNBA" }),
    ).toHaveAttribute("href", "/wnba/matchups");
    expect(
      screen.getByRole("menuitem", { name: "MLB" }),
    ).toHaveAttribute("href", "/mlb/matchups");
    expect(
      screen.queryByRole("menuitem", { name: "About" }),
    ).not.toBeInTheDocument();
  });

  it("shows current league on the mobile trigger and marks it in the menu", async () => {
    const user = userEvent.setup();
    renderNav("/wnba/matchups");

    const trigger = screen.getByRole("button", { name: /wnba/i });
    await user.click(trigger);

    expect(screen.getByRole("menuitem", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("menuitem", { name: "NBA" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("closes the menu on Escape", async () => {
    const user = userEvent.setup();
    renderNav("/");

    await user.click(screen.getByRole("button", { name: /^leagues$/i }));
    expect(screen.getByRole("menu", { name: "Leagues" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("menu", { name: "Leagues" }),
    ).not.toBeInTheDocument();
  });

  it("closes the menu when clicking outside", async () => {
    const user = userEvent.setup();
    renderNav("/");

    await user.click(screen.getByRole("button", { name: /^leagues$/i }));
    expect(screen.getByRole("menu", { name: "Leagues" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(
      screen.queryByRole("menu", { name: "Leagues" }),
    ).not.toBeInTheDocument();
  });
});
