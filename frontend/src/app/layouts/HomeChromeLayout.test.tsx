import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
