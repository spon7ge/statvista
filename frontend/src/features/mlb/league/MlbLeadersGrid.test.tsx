import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ApiMlbLeaderCategory } from "@/shared/lib/api";
import { MlbLeadersGrid } from "./MlbLeadersGrid";

const batting: ApiMlbLeaderCategory = {
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
};

const pitching: ApiMlbLeaderCategory = {
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
};

describe("MlbLeadersGrid", () => {
  it("stacks Batting then Pitching section headers", () => {
    render(<MlbLeadersGrid categories={[batting, pitching]} />);

    expect(screen.getByRole("heading", { name: "Batting" })).toHaveClass(
      "text-[18px]",
    );
    expect(screen.getByRole("heading", { name: "Pitching" })).toHaveClass(
      "text-[18px]",
    );
    expect(screen.queryByText(/season/i)).not.toBeInTheDocument();
    expect(screen.getByText("Data: statsapi.mlb.com")).toHaveClass("text-[14px]");
    expect(screen.getByText("Home Runs")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ERA" })).toBeInTheDocument();
  });

  it("shows twelve loading skeletons across batting and pitching", () => {
    render(<MlbLeadersGrid categories={[]} isLoading />);

    expect(screen.getAllByTestId("leader-skeleton")).toHaveLength(12);
    expect(screen.getByRole("heading", { name: "Batting" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pitching" })).toBeInTheDocument();
  });

  it("shows error copy when leaders have never loaded", () => {
    render(<MlbLeadersGrid categories={[]} isError />);

    expect(screen.getByText(/leaders unavailable/i)).toBeInTheDocument();
  });
});
