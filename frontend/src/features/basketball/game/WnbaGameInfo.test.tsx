import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { detail } from "../lib/testFixtures";
import { WnbaGameInfo } from "./WnbaGameInfo";

describe("WnbaGameInfo", () => {
  it("renders date, broadcast, venue location, and officials", () => {
    render(
      <WnbaGameInfo
        detail={{
          ...detail,
          gameDate: "2026-08-10",
          broadcast: "USA",
          venue: "Climate Pledge Arena",
          venueCity: "Seattle",
          venueState: "WA",
          officials: [
            { name: "Fatou Cissoko-Stephens", order: 1 },
            { name: "Ken Jones", order: 2 },
            { name: "Marcy Williams", order: 3 },
          ],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Game Info" })).toHaveClass(
      "font-semibold",
    );
    expect(screen.getByText("August 10, 2026")).toBeInTheDocument();
    expect(screen.getByText("USA")).toBeInTheDocument();
    expect(screen.getByText("Climate Pledge Arena")).toBeInTheDocument();
    expect(screen.getByText("Seattle, Washington")).toBeInTheDocument();
    expect(
      screen.getByText("Fatou Cissoko-Stephens (Head Official)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Ken Jones")).toBeInTheDocument();
    expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument();
  });

  it("omits empty rows when optional game info is missing", () => {
    render(
      <WnbaGameInfo
        detail={{
          ...detail,
          gameDate: null,
          broadcast: null,
          venue: null,
          venueCity: null,
          venueState: null,
          officials: null,
        }}
      />,
    );
    expect(screen.getByTestId("wnba-game-info")).toBeInTheDocument();
    expect(screen.queryByText("USA")).not.toBeInTheDocument();
  });
});
