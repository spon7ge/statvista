import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildScheduledDetail } from "../lib/testFixtures";
import { NbaPregameCenter } from "./NbaPregameCenter";

vi.mock("@/features/basketball/hooks/useNbaOdds", () => ({
  useNbaOdds: () => ({ data: null, isPending: false }),
}));

vi.mock("@/features/basketball/hooks/useNbaTeamPreview", () => ({
  useNbaTeamPreview: () => ({
    data: null,
    isPending: false,
    isError: false,
  }),
}));

describe("NbaPregameCenter", () => {
  it("shows NBA preview, away, and home tabs", () => {
    const detail = buildScheduledDetail({ league: "nba" });

    render(<NbaPregameCenter detail={detail} />);

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
});
