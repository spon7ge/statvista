import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LeagueSubnav } from "./LeagueSubnav";

function renderSubnav(path: string, league: "wnba" | "nba" | "mlb" = "wnba") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LeagueSubnav league={league} />
    </MemoryRouter>,
  );
}

describe("LeagueSubnav", () => {
  it("links Matchups, Prop Picks, Leaders, and Standings on WNBA; disables others", () => {
    renderSubnav("/wnba/standings");
    const standings = screen.getByRole("link", { name: "Standings" });
    expect(standings).toHaveAttribute("href", "/wnba/standings");
    expect(standings).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Leaders" })).toHaveAttribute(
      "href",
      "/wnba/leaders",
    );
    expect(screen.getByRole("link", { name: "Matchups" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(screen.getByRole("link", { name: "Prop Picks" })).toHaveAttribute(
      "href",
      "/wnba/prop_picks",
    );
  });

  it("marks Prop Picks active on /wnba/prop_picks", () => {
    renderSubnav("/wnba/prop_picks");
    expect(screen.getByRole("link", { name: "Prop Picks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("links MLB Prop Picks to /mlb/prop_picks", () => {
    renderSubnav("/mlb/prop_picks", "mlb");
    const propPicks = screen.getByRole("link", { name: "Prop Picks" });
    expect(propPicks).toHaveAttribute("href", "/mlb/prop_picks");
    expect(propPicks).toHaveAttribute("aria-current", "page");
  });

  it("links MLB Leaders to /mlb/leaders", () => {
    renderSubnav("/mlb/leaders", "mlb");
    const leaders = screen.getByRole("link", { name: "Leaders" });
    expect(leaders).toHaveAttribute("href", "/mlb/leaders");
    expect(leaders).toHaveAttribute("aria-current", "page");
  });

  it("links MLB Standings to /mlb/standings", () => {
    renderSubnav("/mlb/standings", "mlb");
    const standings = screen.getByRole("link", { name: "Standings" });
    expect(standings).toHaveAttribute("href", "/mlb/standings");
    expect(standings).toHaveAttribute("aria-current", "page");
  });

  it("keeps Leaders and Standings disabled on NBA", () => {
    renderSubnav("/nba/matchups", "nba");
    expect(screen.getByRole("button", { name: "Leaders" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Standings" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Matchups" })).toHaveAttribute(
      "href",
      "/nba/matchups",
    );
  });

  it("links Futures to /mlb/futures for mlb", () => {
    renderSubnav("/mlb/futures", "mlb");
    expect(screen.getByRole("link", { name: "Futures" })).toHaveAttribute(
      "href",
      "/mlb/futures",
    );
  });

  it("links Futures for WNBA and leaves it disabled for NBA", () => {
    const { unmount } = renderSubnav("/wnba/futures");
    const futures = screen.getByRole("link", { name: "Futures" });
    expect(futures).toHaveAttribute("href", "/wnba/futures");
    expect(futures).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Clutch" })).not.toBeInTheDocument();
    unmount();

    renderSubnav("/nba/matchups", "nba");
    expect(screen.getByRole("button", { name: "Futures" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Clutch" })).not.toBeInTheDocument();
  });

  it("places Explore and Learn labels inline with a divider before Learn on desktop", () => {
    renderSubnav("/wnba/matchups");
    const exploreLabels = screen.getAllByText("Explore");
    const learnLabels = screen.getAllByText("Learn");
    const desktopExplore = exploreLabels.find((el) => el.tagName === "P");
    const desktopLearn = learnLabels.find((el) => el.tagName === "P");
    expect(desktopExplore).toBeTruthy();
    expect(desktopLearn).toBeTruthy();
    const learnGroup = desktopLearn!.closest("div");
    expect(learnGroup?.className).toMatch(/border-l/);
    expect(learnGroup?.className).toMatch(/items-center/);
    expect(learnGroup?.className).toMatch(/sm:flex/);
    const exploreGroup = desktopExplore!.closest("div");
    expect(exploreGroup?.className).toMatch(/items-center/);
    expect(exploreGroup?.className).toMatch(/sm:flex/);
    expect(screen.getByRole("link", { name: "Matchups" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
  });

  it("shows one mobile sections dropdown trigger", () => {
    renderSubnav("/wnba/matchups");
    const trigger = screen.getByRole("button", { name: /matchups/i });
    expect(trigger.parentElement).toHaveClass("sm:hidden");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens a combined menu with Explore and Learn sections", async () => {
    const user = userEvent.setup();
    renderSubnav("/wnba/standings");

    const trigger = screen.getByRole("button", { name: /standings/i });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const menu = screen.getByRole("menu", { name: "Sections" });
    expect(menu).toBeInTheDocument();

    const exploreHeading = screen.getByText("Explore", {
      selector: "[role='presentation']",
    });
    const learnHeading = screen.getByText("Learn", {
      selector: "[role='presentation']",
    });
    expect(exploreHeading).toHaveClass("text-white/45");
    expect(learnHeading).toHaveClass("text-white/45");
    expect(learnHeading.className).toMatch(/mt-2/);

    expect(screen.getByRole("menuitem", { name: "Matchups" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(screen.getByRole("menuitem", { name: "Standings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("menuitem", { name: "How it works" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Glossary" })).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Sections" })).not.toBeInTheDocument();
  });
});
