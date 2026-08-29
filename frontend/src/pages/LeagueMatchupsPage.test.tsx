import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LeagueMatchupsPage } from "./LeagueMatchupsPage";

vi.mock("@/features/basketball/hooks/useWnbaScoreboard", () => ({
  useWnbaScoreboard: (dateEt?: string) => ({
    games: [],
    isLoading: false,
    hasNeverLoaded: false,
    data: { date: dateEt ?? "2026-08-01", games: [], fetched_at: "" },
  }),
}));

vi.mock("@/features/mlb/hooks/useMlbScoreboard", () => ({
  useMlbScoreboard: (dateEt?: string) => ({
    games: [],
    isLoading: false,
    hasNeverLoaded: false,
    data: { date: dateEt ?? "2026-08-01", games: [], fetched_at: "" },
  }),
}));

const useWnbaOdds = vi.fn(() => ({ data: undefined }));
vi.mock("@/features/basketball/hooks/useWnbaOdds", () => ({
  useWnbaOdds: (...args: unknown[]) => useWnbaOdds(...args),
}));

vi.mock("@/shared/lib/matchupSlateDate", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/lib/matchupSlateDate")>();
  return { ...actual, slateEtDate: () => "2026-08-01" };
});

function renderAt(path: string) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/wnba/matchups"
            element={<LeagueMatchupsPage league="wnba" />}
          />
          <Route
            path="/mlb/matchups"
            element={<LeagueMatchupsPage league="mlb" />}
          />
          <Route
            path="/nba/matchups"
            element={<LeagueMatchupsPage league="nba" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeagueMatchupsPage date nav", () => {
  it("writes ?date when moving off today and clears it returning", async () => {
    const user = userEvent.setup();
    renderAt("/wnba/matchups");
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /previous day/i }));
    expect(screen.getByRole("button", { name: "Jul 31" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Jul 31" }));
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
  });

  it("does not fetch WNBA odds for matchups cards", () => {
    useWnbaOdds.mockClear();
    renderAt("/wnba/matchups");
    expect(useWnbaOdds).not.toHaveBeenCalled();
  });

  it("switches to MLB and NBA matchups from the header pills", async () => {
    const user = userEvent.setup();
    renderAt("/wnba/matchups");
    const header = screen.getByTestId("matchups-header");
    expect(
      within(header).getByRole("link", { name: "WNBA" }),
    ).toHaveAttribute("aria-current", "page");

    await user.click(within(header).getByRole("link", { name: "MLB" }));
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(
      within(screen.getByTestId("matchups-header")).getByRole("link", {
        name: "MLB",
      }),
    ).toHaveAttribute("aria-current", "page");

    await user.click(
      within(screen.getByTestId("matchups-header")).getByRole("link", {
        name: "NBA",
      }),
    );
    expect(screen.getByText(/NBA matchups coming soon/i)).toBeInTheDocument();
    expect(
      within(screen.getByTestId("matchups-header")).getByRole("link", {
        name: "NBA",
      }),
    ).toHaveAttribute("aria-current", "page");
  });
});
