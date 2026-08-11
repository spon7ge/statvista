import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectedStarters } from "./ProjectedStarters";
import { buildScheduledDetail } from "../lib/testFixtures";

describe("ProjectedStarters", () => {
  it("renders starters for both teams", () => {
    render(
      <ProjectedStarters
        detail={buildScheduledDetail({
          projectedStarters: {
            note: "from each team's last game",
            away: [{ jersey: "1", name: "Natasha Howard", position: "F", gtd: false }],
            home: [{ jersey: "10", name: "Maria Conde", position: "F", gtd: false }],
          },
        })}
      />,
    );
    const heading = screen.getByRole("heading", { name: "Projected Starters" });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-center");
    expect(
      screen.queryByText(/from each team's last game/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Natasha Howard")).toBeInTheDocument();
    expect(screen.getByText("Maria Conde")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getAllByText("F")).toHaveLength(2);
    expect(screen.queryByText("GTD")).not.toBeInTheDocument();
  });

  it("shows a red GTD pill for game-time decision starters", () => {
    render(
      <ProjectedStarters
        detail={buildScheduledDetail({
          projectedStarters: {
            note: "RotoWire expected lineup",
            away: [
              {
                jersey: "14",
                name: "Dominique Malonga",
                position: "C",
                gtd: true,
              },
            ],
            home: [
              { jersey: "5", name: "Angel Reese", position: "F", gtd: false },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("GTD")).toBeInTheDocument();
  });

  it("shows team logo, abbrev, and name as column headers", () => {
    render(
      <ProjectedStarters
        detail={buildScheduledDetail({
          away: {
            id: "16",
            abbrev: "MIN",
            name: "Minnesota Lynx",
            score: null,
            record: null,
            last10: null,
            color: "#0C2340",
            logoUrl: "https://example.com/min.png",
          },
          home: {
            id: "129154",
            abbrev: "TOR",
            name: "Toronto Tempo",
            score: null,
            record: null,
            last10: null,
            color: "#CE1141",
            logoUrl: "https://example.com/tor.png",
          },
          projectedStarters: {
            note: "from each team's last game",
            away: [{ jersey: "1", name: "Natasha Howard", position: "F", gtd: false }],
            home: [{ jersey: "10", name: "Maria Conde", position: "F", gtd: false }],
          },
        })}
      />,
    );
    expect(screen.getByText("MIN")).toBeInTheDocument();
    expect(screen.getByText("Minnesota Lynx")).toBeInTheDocument();
    expect(screen.getByText("TOR")).toBeInTheDocument();
    expect(screen.getByText("Toronto Tempo")).toBeInTheDocument();
    expect(
      document.querySelector('img[src="https://example.com/min.png"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('img[src="https://example.com/tor.png"]'),
    ).toBeTruthy();
  });
});
