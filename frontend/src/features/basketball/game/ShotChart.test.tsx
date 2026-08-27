import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { COURT_FILL, ShotChart, toFullCourtPoint } from "./ShotChart";
import { detail } from "../lib/testFixtures";

describe("toFullCourtPoint", () => {
  it("maps away (left) shots from the left basket along court length", () => {
    expect(toFullCourtPoint({ x: 25, y: 5 }, "left")).toEqual({
      cx: 50,
      cy: 250,
    });
  });

  it("maps home (right) shots mirrored from the right basket", () => {
    expect(toFullCourtPoint({ x: 25, y: 5 }, "right")).toEqual({
      cx: 890,
      cy: 250,
    });
  });
});

describe("ShotChart", () => {
  it("exposes a shot chart label and full-court aria label", () => {
    render(<ShotChart detail={detail} />);
    expect(
      screen.getByRole("heading", { name: /shot chart/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /full-court shot chart/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("wnba-shot-chart")).toBeInTheDocument();
  });

  it("shows per-team FGM/FGA on the bottom left and right", () => {
    render(<ShotChart detail={detail} />);
    // Fixture: away made 1/1, home missed 0/1.
    expect(screen.getByText(`${detail.away.abbrev} 1/1`)).toBeInTheDocument();
    expect(screen.getByText(`${detail.home.abbrev} 0/1`)).toBeInTheDocument();
    expect(screen.queryByText("Data: ESPN")).not.toBeInTheDocument();
  });

  it("shows both teams' shots by default on opposite baskets", () => {
    render(<ShotChart detail={detail} />);
    expect(screen.getByRole("img", { name: /A\. Player/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /B\. Player/ })).toBeInTheDocument();
  });

  it("filters shots by period with Scores-style pills", async () => {
    const user = userEvent.setup();
    const withPeriods = {
      ...detail,
      shots: [
        {
          id: "s1",
          teamId: detail.away.id,
          playerName: "A. Player",
          made: true,
          x: 25,
          y: 5,
          period: 1,
          clock: "8:00",
        },
        {
          id: "s2",
          teamId: detail.home.id,
          playerName: "B. Player",
          made: false,
          x: 20,
          y: 10,
          period: 2,
          clock: "7:00",
        },
        {
          id: "s3",
          teamId: detail.away.id,
          playerName: "C. Player",
          made: true,
          x: 30,
          y: 12,
          period: 3,
          clock: "6:00",
        },
      ],
      fgMade: 2,
      fgAttempted: 3,
    };
    render(<ShotChart detail={withPeriods} />);

    expect(screen.getByRole("button", { name: "All" })).toHaveClass(
      "bg-white",
      "text-black",
    );
    expect(screen.getByRole("button", { name: "1Q" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2Q" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3Q" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "1Q" }));
    expect(screen.getByRole("img", { name: /A\. Player/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /B\. Player/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /C\. Player/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(`${detail.away.abbrev} 1/1`)).toBeInTheDocument();
    expect(screen.getByText(`${detail.home.abbrev} 0/0`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByRole("img", { name: /A\. Player/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /B\. Player/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /C\. Player/ })).toBeInTheDocument();
    expect(screen.getByText(`${detail.away.abbrev} 2/2`)).toBeInTheDocument();
    expect(screen.getByText(`${detail.home.abbrev} 0/1`)).toBeInTheDocument();
  });

  it("wraps content in the quiet GameSection surface", () => {
    render(<ShotChart detail={detail} />);
    expect(screen.getByTestId("wnba-shot-chart")).toHaveClass(
      "rounded-2xl",
      "bg-[#1e1e1e]",
      "!p-3",
    );
  });

  it("paints the court with a hardwood fill", () => {
    const { container } = render(<ShotChart detail={detail} />);
    const court = container.querySelector("svg rect");
    expect(court).toHaveAttribute("fill", COURT_FILL);
  });
});
