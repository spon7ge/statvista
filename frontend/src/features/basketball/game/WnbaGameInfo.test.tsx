import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { detail } from "../lib/testFixtures";
import { WnbaGameInfo } from "./WnbaGameInfo";

describe("WnbaGameInfo", () => {
  it("renders venue when present", () => {
    render(<WnbaGameInfo detail={detail} />);

    expect(screen.getByTestId("wnba-game-info")).toBeInTheDocument();
    expect(screen.getByText("Game Info")).toBeInTheDocument();
    expect(screen.getByText(detail.venue!)).toBeInTheDocument();
  });

  it("omits venue row when venue is null", () => {
    render(<WnbaGameInfo detail={{ ...detail, venue: null }} />);

    expect(screen.getByTestId("wnba-game-info")).toBeInTheDocument();
    expect(screen.getByText("Game Info")).toBeInTheDocument();
    expect(
      screen.queryByText("Mortgage Matchup Center"),
    ).not.toBeInTheDocument();
  });
});
