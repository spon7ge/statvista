import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ApiNbaTeamPreviewResponse } from "@/shared/lib/api";
import { buildScheduledDetail } from "../lib/testFixtures";
import { NbaPregameCenter } from "./NbaPregameCenter";

vi.mock("@/features/basketball/hooks/useNbaOdds", () => ({
  useNbaOdds: () => ({ data: null, isPending: false }),
}));

const fetchNbaTeamPreview = vi.fn();

vi.mock("@/shared/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/api")>();
  return {
    ...actual,
    fetchNbaTeamPreview: (...args: unknown[]) =>
      fetchNbaTeamPreview(...args),
  };
});

const emptyTeamPreview: ApiNbaTeamPreviewResponse = {
  side: "away",
  team: {
    id: "13",
    abbrev: "LAL",
    name: "Los Angeles Lakers",
    logo_url: null,
  },
  leaders: [],
  roster: [],
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("NbaPregameCenter", () => {
  beforeEach(() => {
    fetchNbaTeamPreview.mockReset();
    fetchNbaTeamPreview.mockResolvedValue(emptyTeamPreview);
  });

  it("shows NBA preview, away, and home tabs", () => {
    const detail = buildScheduledDetail({ league: "nba" });

    renderWithClient(<NbaPregameCenter detail={detail} />);

    expect(screen.getByTestId("nba-pregame-center")).toBeInTheDocument();
    expect(
      screen.getByTestId("nba-pregame-broadcast-header"),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: detail.away.name }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: detail.home.name }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Props" })).not.toBeInTheDocument();
  });

  it("loads the selected Away team preview", async () => {
    const detail = buildScheduledDetail({ league: "nba" });
    const user = userEvent.setup();
    renderWithClient(<NbaPregameCenter detail={detail} />);

    await waitFor(() => expect(fetchNbaTeamPreview).not.toHaveBeenCalled());
    await user.click(screen.getByRole("tab", { name: detail.away.name }));

    expect(await screen.findByTestId("nba-team-preview")).toBeInTheDocument();
    expect(fetchNbaTeamPreview).toHaveBeenCalledWith({
      espnEventId: detail.espnEventId,
      side: "away",
    });
  });
});
