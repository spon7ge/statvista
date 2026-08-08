import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MlbMatchupPrediction } from "./MlbMatchupPrediction";
import { mlbScheduledDetail } from "../lib/testFixtures";

describe("MlbMatchupPrediction", () => {
  it("renders bar, percents, and source", () => {
    const awayAbbrev = mlbScheduledDetail.away.abbrev;
    const homeAbbrev = mlbScheduledDetail.home.abbrev;
    const awayWinPct = 59;
    const homeWinPct = 41;

    const { container } = render(
      <MlbMatchupPrediction
        detail={{
          ...mlbScheduledDetail,
          matchupPrediction: {
            awayWinPct,
            homeWinPct,
            sourceLabel: "ESPN game projection",
          },
        }}
      />,
    );
    expect(screen.getByText("Matchup prediction")).toBeInTheDocument();
    expect(
      screen.getByText((_content, node) => {
        const text = node?.textContent ?? "";
        return (
          node?.tagName === "SPAN" &&
          text.includes(awayAbbrev) &&
          text.includes(`${awayWinPct}%`)
        );
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_content, node) => {
        const text = node?.textContent ?? "";
        return (
          node?.tagName === "SPAN" &&
          text.includes(homeAbbrev) &&
          text.includes(`${homeWinPct}%`)
        );
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("ESPN game projection")).toBeInTheDocument();
    expect(screen.getByText("Matchup prediction").closest("section")).toHaveClass(
      "bg-[#3a3d42]",
    );

    const barSegments = container.querySelectorAll(".mt-3.flex.h-2 > div");
    expect(barSegments).toHaveLength(2);
    expect(barSegments[0]).toHaveStyle({ width: `${awayWinPct}%` });
  });

  it("renders nothing without prediction", () => {
    const { container } = render(
      <MlbMatchupPrediction
        detail={{ ...mlbScheduledDetail, matchupPrediction: null }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
