import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ApiMlbLeaderCategory } from "@/shared/lib/api";
import { MlbLeadersGrid } from "./MlbLeadersGrid";

const categories: ApiMlbLeaderCategory[] = [
  {
    key: "hr",
    label: "Home Runs",
    stat: "HR",
    leaders: [
      {
        rank: 1,
        player_id: "592450",
        name: "Aaron Judge",
        team_abbrev: "NYY",
        gp: 98,
        value: "38",
      },
    ],
  },
];

describe("MlbLeadersGrid", () => {
  it("renders season-only context and Stats API attribution", () => {
    render(<MlbLeadersGrid season={2026} categories={categories} />);

    expect(screen.getByText("2026 season")).toHaveClass("text-[14px]");
    expect(screen.queryByText(/per game/i)).not.toBeInTheDocument();
    expect(screen.getByText("Data: statsapi.mlb.com")).toHaveClass("text-[14px]");
  });

  it("shows twelve loading skeletons", () => {
    render(<MlbLeadersGrid season={2026} categories={[]} isLoading />);

    expect(screen.getAllByTestId("leader-skeleton")).toHaveLength(12);
  });

  it("shows error copy when leaders have never loaded", () => {
    render(<MlbLeadersGrid season={2026} categories={[]} isError />);

    expect(screen.getByText(/leaders unavailable/i)).toBeInTheDocument();
  });
});
