import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MlbMatchupPrediction } from "./MlbMatchupPrediction";
import { mlbTeamLogoUrl } from "../league/mlbTeamLogos";
import { mlbScheduledDetail } from "../lib/testFixtures";

describe("MlbMatchupPrediction", () => {
  it("renders taller pill with white percents, logos, and white abbrevs", () => {
    const awayAbbrev = mlbScheduledDetail.away.abbrev;
    const homeAbbrev = mlbScheduledDetail.home.abbrev;
    const awayWinPct = 59;
    const homeWinPct = 41;
    const awayLogo = mlbTeamLogoUrl(awayAbbrev);
    const homeLogo = mlbTeamLogoUrl(homeAbbrev);

    render(
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
    expect(screen.getByText(awayAbbrev)).toHaveClass("text-white");
    expect(screen.getByText(homeAbbrev)).toHaveClass("text-white");
    expect(screen.getByText(`${awayWinPct}%`)).toBeInTheDocument();
    expect(screen.getByText(`${homeWinPct}%`)).toBeInTheDocument();
    expect(screen.queryByText("ESPN game projection")).not.toBeInTheDocument();
    expect(screen.getByText("Matchup prediction").closest("section")).toHaveClass(
      "bg-[#1c1e22]",
    );

    const pill = screen.getByTestId("mlb-matchup-prediction-pill");
    expect(pill).toHaveClass("h-9");
    const segments = pill.querySelectorAll(":scope > div");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveStyle({ width: `${awayWinPct}%` });
    expect(segments[0]).toHaveTextContent(`${awayWinPct}%`);
    expect(segments[0]).toHaveClass("text-white");
    expect(segments[1]).toHaveTextContent(`${homeWinPct}%`);

    const imgs = Array.from(
      screen.getByTestId("mlb-matchup-prediction").querySelectorAll("img"),
    );
    expect(imgs.map((img) => img.getAttribute("src"))).toEqual(
      expect.arrayContaining([awayLogo, homeLogo]),
    );
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
