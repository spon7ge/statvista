import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MlbGameLeaders } from "./MlbGameLeaders";
import { mlbScheduledDetail } from "../lib/testFixtures";
import type { MlbGameLeaders as MlbGameLeadersPayload } from "../lib/types";

const gameLeadersPayload: MlbGameLeadersPayload = {
  leaders: [
    {
      key: "hr",
      label: "HR",
      rank: 1,
      value: "42",
      playerId: "p1",
      lastName: "Schwarber",
      teamAbbrev: "PHI",
      side: "home",
      headshotUrl:
        "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png",
    },
    {
      key: "avg",
      label: "AVG",
      rank: 3,
      value: ".312",
      playerId: "p2",
      lastName: "Abrams",
      teamAbbrev: "WSH",
      side: "away",
      headshotUrl:
        "https://a.espncdn.com/i/headshots/mlb/players/full/682928.png",
    },
    {
      key: "ops",
      label: "OPS",
      rank: null,
      value: ".950",
      playerId: "p3",
      lastName: "Harper",
      teamAbbrev: "PHI",
      side: "home",
      headshotUrl: null,
    },
  ],
};

describe("MlbGameLeaders", () => {
  it("renders nothing when gameLeaders is null", () => {
    const { container } = render(
      <MlbGameLeaders detail={{ ...mlbScheduledDetail, gameLeaders: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when leaders array is empty", () => {
    const { container } = render(
      <MlbGameLeaders
        detail={{ ...mlbScheduledDetail, gameLeaders: { leaders: [] } }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders title Game Leaders and three stat cards", () => {
    render(
      <MlbGameLeaders
        detail={{ ...mlbScheduledDetail, gameLeaders: gameLeadersPayload }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Game Leaders" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-leader-card-hr")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-leader-card-avg")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-leader-card-ops")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-leader-card-hr")).toHaveStyle({
      backgroundColor: mlbScheduledDetail.home.color,
    });
    expect(screen.getByTestId("mlb-game-leader-card-avg")).toHaveStyle({
      backgroundColor: mlbScheduledDetail.away.color,
    });
  });

  it("shows value, rank, last name, team logo, and headshot on each card", () => {
    render(
      <MlbGameLeaders
        detail={{ ...mlbScheduledDetail, gameLeaders: gameLeadersPayload }}
      />,
    );

    const hrCard = screen.getByTestId("mlb-game-leader-card-hr");
    expect(hrCard).toHaveTextContent("HR");
    expect(hrCard).toHaveTextContent("42");
    expect(screen.getByTestId("mlb-game-leader-rank-hr")).toHaveTextContent("#1");
    expect(hrCard).toHaveTextContent("Schwarber");
    expect(
      hrCard.querySelector('img[src*="mlbstatic.com/team-logos"]'),
    ).toBeTruthy();
    expect(screen.getByTestId("mlb-game-leader-headshot-hr")).toHaveAttribute(
      "src",
      gameLeadersPayload.leaders[0].headshotUrl,
    );

    const avgCard = screen.getByTestId("mlb-game-leader-card-avg");
    expect(avgCard).toHaveTextContent(".312");
    expect(screen.getByTestId("mlb-game-leader-rank-avg")).toHaveTextContent(
      "#3",
    );
    expect(avgCard).toHaveTextContent("Abrams");
  });

  it("omits rank when rank is null", () => {
    render(
      <MlbGameLeaders
        detail={{ ...mlbScheduledDetail, gameLeaders: gameLeadersPayload }}
      />,
    );

    expect(
      screen.queryByTestId("mlb-game-leader-rank-ops"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-leader-card-ops")).not.toHaveTextContent(
      "#",
    );
  });

  it("uses initials fallback when headshot is null", () => {
    render(
      <MlbGameLeaders
        detail={{ ...mlbScheduledDetail, gameLeaders: gameLeadersPayload }}
      />,
    );

    expect(
      screen.getByTestId("mlb-game-leader-headshot-fallback-ops"),
    ).toHaveTextContent("H");
    expect(
      screen.queryByTestId("mlb-game-leader-headshot-ops"),
    ).not.toBeInTheDocument();
  });

  it("falls back to initials when headshot image fails to load", () => {
    render(
      <MlbGameLeaders
        detail={{ ...mlbScheduledDetail, gameLeaders: gameLeadersPayload }}
      />,
    );

    fireEvent.error(screen.getByTestId("mlb-game-leader-headshot-hr"));

    expect(
      screen.getByTestId("mlb-game-leader-headshot-fallback-hr"),
    ).toHaveTextContent("S");
    expect(
      screen.queryByTestId("mlb-game-leader-headshot-hr"),
    ).not.toBeInTheDocument();
  });
});
