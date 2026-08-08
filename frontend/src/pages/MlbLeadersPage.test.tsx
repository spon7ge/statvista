import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MlbLeadersPage } from "./MlbLeadersPage";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/mlb/leaders"]}>
        <MlbLeadersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MlbLeadersPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders season leaders from the MLB API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        season: 2026,
        pace: "season",
        categories: [
          {
            key: "avg",
            label: "Batting Average",
            stat: "AVG",
            leaders: [
              {
                rank: 1,
                player_id: "592450",
                name: "Aaron Judge",
                team_abbrev: "NYY",
                gp: 98,
                value: ".345",
              },
            ],
          },
          {
            key: "era",
            label: "ERA",
            stat: "ERA",
            leaders: [
              {
                rank: 1,
                player_id: "1",
                name: "Ace Pitcher",
                team_abbrev: "LAD",
                gp: 20,
                value: "2.10",
              },
            ],
          },
        ],
      }),
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "MLB 2026 Leaders" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Batting" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pitching" })).toBeInTheDocument();
    expect(screen.getByText("Batting Average")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ERA" })).toBeInTheDocument();
    expect(screen.getByText("Data: statsapi.mlb.com")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/mlb/leaders"),
      expect.any(Object),
    );
  });
});
