import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbGameInfo } from "./MlbGameInfo";
import { mlbScheduledDetail } from "../lib/testFixtures";
import type { MlbGameDetailView } from "../lib/types";

const fullDetail: MlbGameDetailView = {
  ...mlbScheduledDetail,
  gameDate: "2026-08-07",
  venue: "Yankee Stadium",
  venueCity: "Bronx",
  venueState: "New York",
  weather: {
    condition: "Partly Cloudy",
    tempF: "74",
    wind: "2 mph N",
  },
  umpires: {
    homePlate: "Mark Ripperger",
    firstBase: "Dan Merzel",
    secondBase: "Dan Bellino",
    thirdBase: "Derek Thomas",
  },
};

const minimalDetail: MlbGameDetailView = {
  ...mlbScheduledDetail,
  gameDate: "2026-08-07",
  venue: "Yankee Stadium",
  venueCity: "Bronx",
  venueState: "New York",
  weather: null,
  umpires: null,
};

describe("MlbGameInfo", () => {
  it("renders date, venue, weather, and umpires", () => {
    render(<MlbGameInfo detail={fullDetail} />);
    expect(screen.getByTestId("mlb-game-info")).toHaveClass("rounded-2xl");
    expect(screen.getByRole("heading", { name: "Game Info" })).toHaveClass(
      "font-semibold",
    );
    expect(screen.getByText("August 7, 2026")).toBeInTheDocument();
    expect(screen.getByText("Yankee Stadium")).toBeInTheDocument();
    expect(screen.getByText("Bronx, New York")).toBeInTheDocument();
    expect(screen.getByText("74°")).toBeInTheDocument();
    expect(screen.getByText("2 mph N")).toBeInTheDocument();
    expect(screen.getByText(/Home Plate/)).toBeInTheDocument();
    expect(screen.getByText("Mark Ripperger")).toBeInTheDocument();
  });

  it("omits weather and umpires rows when null", () => {
    render(<MlbGameInfo detail={minimalDetail} />);
    expect(screen.getByTestId("mlb-game-info")).toBeInTheDocument();
    expect(screen.getByText("Game Info")).toBeInTheDocument();
    expect(screen.queryByText("74°")).not.toBeInTheDocument();
    expect(screen.queryByText(/Home Plate/)).not.toBeInTheDocument();
  });
});
