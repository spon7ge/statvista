import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LeadersGrid } from "./LeadersGrid";
import type { ApiWnbaLeaderCategory } from "@/shared/lib/api";

function renderGrid(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const categories: ApiWnbaLeaderCategory[] = [
  {
    key: "points",
    label: "Points",
    stat: "PTS",
    leaders: [
      {
        rank: 1,
        player_id: "1",
        name: "A'ja Wilson",
        team_abbrev: "LVA",
        gp: 25,
        value: "26.2",
      },
    ],
  },
  {
    key: "rebounds",
    label: "Rebounds",
    stat: "REB",
    leaders: [],
  },
];

describe("LeadersGrid", () => {
  it("renders cards, colors, and attribution", () => {
    renderGrid(<LeadersGrid categories={categories} />);
    expect(screen.getByText("Points")).toBeInTheDocument();
    expect(screen.getByText("A'ja Wilson")).toBeInTheDocument();
    expect(screen.getByText("LVA")).toBeInTheDocument();
    expect(screen.getByText("26.2")).toBeInTheDocument();
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByText("Data: stats.wnba.com")).toBeInTheDocument();
  });

  it("shows loading skeletons", () => {
    renderGrid(<LeadersGrid categories={[]} isLoading />);
    expect(screen.getByLabelText(/loading leaders/i)).toBeInTheDocument();
  });

  it("shows error copy when never loaded", () => {
    renderGrid(<LeadersGrid categories={[]} isError />);
    expect(screen.getByText(/leaders unavailable/i)).toBeInTheDocument();
  });
});
