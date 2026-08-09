import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MlbMatchupLeaders } from "./MlbMatchupLeaders";
import { mlbScheduledDetail } from "../lib/testFixtures";
import type { MlbMatchupLeaders as MlbMatchupLeadersPayload } from "../lib/types";

const matchupLeadersPayload: MlbMatchupLeadersPayload = {
  categories: [
    {
      key: "hr",
      label: "HR",
      leaders: [
        {
          rank: 1,
          playerId: "p1",
          name: "Kyle Schwarber",
          teamAbbrev: "PHI",
          side: "home",
          value: "42",
        },
        {
          rank: 2,
          playerId: "p2",
          name: "James Wood",
          teamAbbrev: "WSH",
          side: "away",
          value: "38",
        },
        {
          rank: 3,
          playerId: "p3",
          name: "Bryce Harper",
          teamAbbrev: "PHI",
          side: "home",
          value: "35",
        },
      ],
    },
    {
      key: "avg",
      label: "AVG",
      leaders: [
        {
          rank: 1,
          playerId: "p4",
          name: "CJ Abrams",
          teamAbbrev: "WSH",
          side: "away",
          value: ".312",
        },
      ],
    },
    {
      key: "ops",
      label: "OPS",
      leaders: [],
    },
    {
      key: "era",
      label: "ERA",
      leaders: [],
    },
    {
      key: "so",
      label: "SO",
      leaders: [],
    },
    {
      key: "whip",
      label: "WHIP",
      leaders: [],
    },
  ],
};

describe("MlbMatchupLeaders", () => {
  it("renders nothing when matchupLeaders is null", () => {
    const { container } = render(
      <MlbMatchupLeaders
        detail={{ ...mlbScheduledDetail, matchupLeaders: null }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders title and category tabs", () => {
    render(
      <MlbMatchupLeaders
        detail={{ ...mlbScheduledDetail, matchupLeaders: matchupLeadersPayload }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Matchup Leaders" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "HR" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "AVG" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "OPS" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "ERA" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "SO" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "WHIP" })).toBeInTheDocument();
  });

  it("defaults to HR tab and lists up to three leaders", () => {
    render(
      <MlbMatchupLeaders
        detail={{ ...mlbScheduledDetail, matchupLeaders: matchupLeadersPayload }}
      />,
    );

    const list = screen.getByTestId("mlb-matchup-leaders-list");
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByTestId("mlb-matchup-leader-p1")).toHaveTextContent(
      "#1",
    );
    expect(screen.getByTestId("mlb-matchup-leader-p1")).toHaveTextContent(
      "Kyle Schwarber",
    );
    expect(screen.getByTestId("mlb-matchup-leader-p1")).toHaveTextContent(
      "PHI",
    );
    expect(screen.getByTestId("mlb-matchup-leader-p1")).toHaveTextContent("42");
    expect(screen.getByText("James Wood")).toBeInTheDocument();
    expect(screen.getByText("Bryce Harper")).toBeInTheDocument();
  });

  it("shows empty state when active category has no leaders", () => {
    render(
      <MlbMatchupLeaders
        detail={{ ...mlbScheduledDetail, matchupLeaders: matchupLeadersPayload }}
      />,
    );

    fireEvent.click(screen.getByTestId("mlb-matchup-leaders-tab-ops"));

    expect(
      screen.getByText("No top leaders on either roster."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-matchup-leaders-list")).not.toBeInTheDocument();
  });

  it("switches leader list when clicking AVG tab", () => {
    render(
      <MlbMatchupLeaders
        detail={{ ...mlbScheduledDetail, matchupLeaders: matchupLeadersPayload }}
      />,
    );

    fireEvent.click(screen.getByTestId("mlb-matchup-leaders-tab-avg"));

    const list = screen.getByTestId("mlb-matchup-leaders-list");
    expect(list.querySelectorAll("li")).toHaveLength(1);
    expect(screen.getByTestId("mlb-matchup-leader-p4")).toHaveTextContent(
      "CJ Abrams",
    );
    expect(screen.getByTestId("mlb-matchup-leader-p4")).toHaveTextContent(
      ".312",
    );
    expect(screen.queryByText("Kyle Schwarber")).not.toBeInTheDocument();
  });
});
