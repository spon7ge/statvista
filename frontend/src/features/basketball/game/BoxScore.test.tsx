import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoxScore } from "./BoxScore";
import { buildGameDetailFixture } from "../lib/testFixtures";

describe("BoxScore", () => {
  it("renders both team box scores with player stats and DNP", () => {
    render(
      <BoxScore
        detail={buildGameDetailFixture({
          boxScore: {
            columns: [
              "MIN",
              "PTS",
              "FG",
              "3PT",
              "FT",
              "REB",
              "AST",
              "TO",
              "STL",
              "BLK",
              "OREB",
              "DREB",
              "PF",
              "+/-",
            ],
            away: [
              {
                name: "Kayla Thornton",
                didNotPlay: false,
                values: [
                  "25",
                  "6",
                  "2-7",
                  "2-5",
                  "0-0",
                  "8",
                  "2",
                  "0",
                  "0",
                  "0",
                  "4",
                  "4",
                  "5",
                  "+6",
                ],
              },
              {
                name: "Gabby Williams",
                didNotPlay: true,
                values: Array(14).fill(""),
              },
            ],
            home: [
              {
                name: "Alyssa Thomas",
                didNotPlay: false,
                values: [
                  "30",
                  "12",
                  "5-10",
                  "0-1",
                  "2-2",
                  "7",
                  "5",
                  "2",
                  "1",
                  "0",
                  "2",
                  "5",
                  "3",
                  "+4",
                ],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText("GS")).toBeInTheDocument();
    expect(screen.getByText("Golden State Valkyries")).toBeInTheDocument();
    expect(screen.getByText("PHX")).toBeInTheDocument();
    expect(screen.getByText("Kayla Thornton")).toBeInTheDocument();
    expect(screen.getByText("Gabby Williams")).toBeInTheDocument();
    expect(screen.getByText("DNP")).toBeInTheDocument();
    expect(screen.getByText("Alyssa Thomas")).toBeInTheDocument();
    expect(screen.getAllByText("MIN").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+/-").length).toBeGreaterThan(0);
  });

  it("renders away and home in separate stacked GameSections", () => {
    render(
      <BoxScore
        detail={buildGameDetailFixture({
          boxScore: {
            columns: ["MIN", "PTS"],
            away: [
              { name: "Kayla Thornton", didNotPlay: false, values: ["25", "6"] },
            ],
            home: [
              { name: "Alyssa Thomas", didNotPlay: false, values: ["30", "12"] },
            ],
          },
        })}
      />,
    );

    const root = screen.getByTestId("wnba-box-score");
    expect(root).toHaveClass("space-y-4");

    const away = screen.getByTestId("wnba-box-team-away");
    const home = screen.getByTestId("wnba-box-team-home");
    expect(away.tagName.toLowerCase()).toBe("section");
    expect(home.tagName.toLowerCase()).toBe("section");
    expect(away).toHaveClass("rounded-xl", "bg-[#1c1e22]", "!p-3");
    expect(home).toHaveClass("rounded-xl", "bg-[#1c1e22]", "!p-3");
    expect(away).not.toBe(home);
    expect(
      away.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(within(away).getByText("Kayla Thornton")).toBeInTheDocument();
    expect(within(home).getByText("Alyssa Thomas")).toBeInTheDocument();
  });

  it("omits empty team card and still wraps the other", () => {
    render(
      <BoxScore
        detail={buildGameDetailFixture({
          boxScore: {
            columns: ["MIN", "PTS"],
            away: [
              { name: "Kayla Thornton", didNotPlay: false, values: ["25", "6"] },
            ],
            home: [],
          },
        })}
      />,
    );
    expect(screen.getByTestId("wnba-box-team-away")).toBeInTheDocument();
    expect(screen.queryByTestId("wnba-box-team-home")).not.toBeInTheDocument();
  });

  it("renders nothing without box score data", () => {
    const { container } = render(
      <BoxScore detail={buildGameDetailFixture({ boxScore: null })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("wraps content in the quiet GameSection surface", () => {
    render(
      <BoxScore
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
    const section = screen.getByTestId("wnba-box-team-away");
    expect(section).toHaveClass("rounded-xl", "bg-[#1c1e22]", "!p-3");
    expect(section).not.toHaveClass("border-white/10");
  });
});
