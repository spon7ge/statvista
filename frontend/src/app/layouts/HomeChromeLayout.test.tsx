import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HomeChromeLayout } from "./HomeChromeLayout";

vi.mock("@/features/basketball/hooks/useWnbaScoreboard", () => ({
  useWnbaScoreboard: () => ({
    isLoading: false,
    hasNeverLoaded: false,
    tickerGames: [
      {
        id: "1",
        league: "wnba",
        awayAbbrev: "ATL",
        homeAbbrev: "DAL",
        awayLogoUrl: null,
        homeLogoUrl: null,
        statusLabel: "Q3 7:13",
        status: "live",
        awayScore: 36,
        homeScore: 44,
      },
    ],
    liveGames: [],
  }),
}));

vi.mock("@/features/mlb/hooks/useMlbScoreboard", () => ({
  useMlbScoreboard: () => ({
    isLoading: false,
    hasNeverLoaded: false,
    tickerGames: [
      {
        id: "mlb-9",
        league: "mlb",
        mlbGamePk: "9",
        awayAbbrev: "BOS",
        homeAbbrev: "NYY",
        awayLogoUrl: null,
        homeLogoUrl: null,
        statusLabel: "Top 3rd",
        status: "live",
        awayScore: 2,
        homeScore: 3,
      },
    ],
    liveGames: [],
  }),
}));

describe("HomeChromeLayout", () => {
  it("renders ticker games from merged WNBA and MLB scoreboards", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/" element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getAllByText("ATL").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("DAL").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("BOS").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("NYY").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/informational and entertainment purposes only/i),
    ).toBeInTheDocument();
  });

  it("puts a primary sidebar beside the ticker, not HomeNav", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/" element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^leagues$/i }),
    ).not.toBeInTheDocument();

    const sidebar = screen.getByRole("navigation", { name: "Primary" }).closest(
      "aside",
    );
    expect(sidebar).toHaveClass("hidden", "sm:flex", "w-60");
    const root = container.firstElementChild;
    expect(root).toHaveClass("sm:flex-row");
  });

  it("opens a mobile drawer from the hamburger and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/wnba/matchups"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/wnba/matchups" element={<div>matchups</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const bar = screen.getByRole("banner");
    expect(bar).toHaveClass("sm:hidden");
    expect(within(bar).getByRole("link", { name: "statvista" })).toHaveAttribute(
      "href",
      "/",
    );

    const open = screen.getByRole("button", { name: "Open menu" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();

    await user.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    const drawer = document.getElementById("app-sidebar-drawer");
    expect(drawer).toBeTruthy();
    expect(within(drawer!).getByRole("link", { name: "WNBA" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
    expect(open).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the drawer after navigating a sidebar link", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/" element={<div>home</div>} />
            <Route path="/wnba/matchups" element={<div>matchups</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("app-sidebar-drawer");
    await user.click(within(drawer!).getByRole("link", { name: "WNBA" }));
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
    expect(screen.getByText("matchups")).toBeInTheDocument();
  });
});
