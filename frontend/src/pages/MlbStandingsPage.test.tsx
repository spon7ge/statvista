import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MlbStandingsPage } from "./MlbStandingsPage";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/mlb/standings"]}>
        <MlbStandingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MlbStandingsPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders season standings from the MLB API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        season: 2026,
        leagues: [
          {
            key: "al",
            label: "American League",
            divisions: [
              {
                key: "al_east",
                label: "AL East",
                teams: [
                  {
                    rank: 1,
                    team_id: "139",
                    abbrev: "TB",
                    name: "Rays",
                    logo_url: null,
                    wins: 69,
                    losses: 46,
                    wl: "69-46",
                    pct: ".600",
                    gb: "-",
                    l10: "7-3",
                    streak: "W4",
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "MLB 2026 Standings" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("AL East")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "American League" }),
    ).toBeInTheDocument();
    expect(screen.getByText("TB")).toBeInTheDocument();
    expect(screen.getByText("Data: statsapi.mlb.com")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/mlb/standings"),
      expect.any(Object),
    );
  });

  it("switches to conference league tables when Conference tab is clicked", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        season: 2026,
        leagues: [
          {
            key: "al",
            label: "American League",
            divisions: [
              {
                key: "al_east",
                label: "AL East",
                teams: [
                  {
                    rank: 1,
                    team_id: "139",
                    abbrev: "TB",
                    name: "Rays",
                    logo_url: null,
                    wins: 69,
                    losses: 46,
                    wl: "69-46",
                    pct: ".600",
                    gb: "-",
                    l10: "7-3",
                    streak: "W4",
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    renderPage();

    expect(await screen.findByText("AL East")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Conference" }));
    expect(screen.queryByText("AL East")).not.toBeInTheDocument();
    expect(screen.getByText("American League")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Conference" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
