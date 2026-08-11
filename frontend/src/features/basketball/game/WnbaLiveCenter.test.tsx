import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildGameDetailFixture, detail } from "../lib/testFixtures";
import { WnbaLiveCenter } from "./WnbaLiveCenter";

describe("WnbaLiveCenter", () => {
  it("renders live center with play feed and shot chart on summary", () => {
    render(<WnbaLiveCenter detail={detail} />);

    expect(screen.getByTestId("wnba-live-center")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-broadcast-header")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-play-feed")).toBeInTheDocument();
    expect(screen.getByText("Shot chart")).toBeInTheDocument();
  });

  it("uses a two-column summary grid and hides summary on Boxscore tab", async () => {
    const user = userEvent.setup();
    render(
      <WnbaLiveCenter
        detail={buildGameDetailFixture({
          boxScore: {
            columns: ["MIN", "PTS"],
            away: [
              {
                name: "Kayla Thornton",
                didNotPlay: false,
                values: ["25", "6"],
              },
            ],
            home: [],
          },
        })}
      />,
    );

    const summary = screen.getByRole("tabpanel", { name: /summary/i });
    expect(summary).toHaveClass("lg:grid-cols-2");
    expect(within(summary).getByTestId("wnba-play-feed")).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-pitch-zone")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /boxscore/i }));

    expect(screen.getByText("Kayla Thornton")).toBeInTheDocument();
    expect(screen.queryByTestId("wnba-play-feed")).not.toBeInTheDocument();
    expect(screen.queryByText("Shot chart")).not.toBeInTheDocument();
  });
});
