import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { buildScheduledDetail } from "../lib/testFixtures";
import type { GameDetailGameLeaders } from "../lib/types";
import { WnbaGameLeaders } from "./WnbaGameLeaders";

const scheduled = buildScheduledDetail({
  away: {
    id: "away1",
    abbrev: "LVA",
    name: "Las Vegas Aces",
    score: null,
    record: null,
    last10: null,
    color: "#000000",
    logoUrl: "https://example.com/lva.svg",
  },
  home: {
    id: "home1",
    abbrev: "NY",
    name: "New York Liberty",
    score: null,
    record: null,
    last10: null,
    color: "#86CEBC",
    logoUrl: "https://example.com/ny.svg",
  },
});

const gameLeadersPayload: GameDetailGameLeaders = {
  leaders: [
    {
      key: "ppg",
      label: "PPG",
      rank: 1,
      value: "26.6",
      playerId: "p1",
      lastName: "Wilson",
      teamAbbrev: "LVA",
      side: "away",
      headshotUrl:
        "https://a.espncdn.com/i/headshots/wnba/players/full/4066457.png",
    },
    {
      key: "rpg",
      label: "RPG",
      rank: 3,
      value: "9.4",
      playerId: "p2",
      lastName: "Stewart",
      teamAbbrev: "NY",
      side: "home",
      headshotUrl:
        "https://a.espncdn.com/i/headshots/wnba/players/full/3147657.png",
    },
    {
      key: "apg",
      label: "APG",
      rank: null,
      value: "8.1",
      playerId: "p3",
      lastName: "Gray",
      teamAbbrev: "LVA",
      side: "away",
      headshotUrl: null,
    },
  ],
};

describe("WnbaGameLeaders", () => {
  it("renders nothing when gameLeaders is null", () => {
    const { container } = render(
      <WnbaGameLeaders detail={{ ...scheduled, gameLeaders: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when leaders array is empty", () => {
    const { container } = render(
      <WnbaGameLeaders
        detail={{ ...scheduled, gameLeaders: { leaders: [] } }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders title Game Leaders and three PPG/RPG/APG cards", () => {
    render(
      <WnbaGameLeaders
        detail={{ ...scheduled, gameLeaders: gameLeadersPayload }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Game Leaders" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("wnba-game-leader-card-ppg")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-game-leader-card-rpg")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-game-leader-card-apg")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-game-leader-card-ppg")).toHaveStyle({
      backgroundColor: scheduled.away.color,
    });
    expect(screen.getByTestId("wnba-game-leader-card-rpg")).toHaveStyle({
      backgroundColor: scheduled.home.color,
    });
  });

  it("shows value, rank, last name, team logo, and headshot on each card", () => {
    render(
      <WnbaGameLeaders
        detail={{ ...scheduled, gameLeaders: gameLeadersPayload }}
      />,
    );

    const ppgCard = screen.getByTestId("wnba-game-leader-card-ppg");
    expect(ppgCard).toHaveTextContent("PPG");
    expect(ppgCard).toHaveTextContent("26.6");
    expect(screen.getByTestId("wnba-game-leader-rank-ppg")).toHaveTextContent(
      "#1",
    );
    expect(ppgCard).toHaveTextContent("Wilson");
    expect(
      ppgCard.querySelector('img[src="https://example.com/lva.svg"]'),
    ).toBeTruthy();
    expect(screen.getByTestId("wnba-game-leader-headshot-ppg")).toHaveAttribute(
      "src",
      gameLeadersPayload.leaders[0].headshotUrl,
    );

    const rpgCard = screen.getByTestId("wnba-game-leader-card-rpg");
    expect(rpgCard).toHaveTextContent("RPG");
    expect(rpgCard).toHaveTextContent("9.4");
    expect(screen.getByTestId("wnba-game-leader-rank-rpg")).toHaveTextContent(
      "#3",
    );
    expect(rpgCard).toHaveTextContent("Stewart");
  });

  it("omits rank when rank is null", () => {
    render(
      <WnbaGameLeaders
        detail={{ ...scheduled, gameLeaders: gameLeadersPayload }}
      />,
    );

    expect(
      screen.queryByTestId("wnba-game-leader-rank-apg"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("wnba-game-leader-card-apg"),
    ).not.toHaveTextContent("#");
  });

  it("uses initials fallback when headshot is null", () => {
    render(
      <WnbaGameLeaders
        detail={{ ...scheduled, gameLeaders: gameLeadersPayload }}
      />,
    );

    expect(
      screen.getByTestId("wnba-game-leader-headshot-fallback-apg"),
    ).toHaveTextContent("G");
    expect(
      screen.queryByTestId("wnba-game-leader-headshot-apg"),
    ).not.toBeInTheDocument();
  });

  it("falls back to initials when headshot image fails to load", () => {
    render(
      <WnbaGameLeaders
        detail={{ ...scheduled, gameLeaders: gameLeadersPayload }}
      />,
    );

    fireEvent.error(screen.getByTestId("wnba-game-leader-headshot-ppg"));

    expect(
      screen.getByTestId("wnba-game-leader-headshot-fallback-ppg"),
    ).toHaveTextContent("W");
    expect(
      screen.queryByTestId("wnba-game-leader-headshot-ppg"),
    ).not.toBeInTheDocument();
  });
});
