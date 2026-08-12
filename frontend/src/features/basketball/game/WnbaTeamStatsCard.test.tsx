import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildGameDetailFixture, detail } from "../lib/testFixtures";
import { WnbaTeamStatsCard } from "./WnbaTeamStatsCard";

describe("WnbaTeamStatsCard", () => {
  it("renders winProbability teamStats rows", () => {
    const withStats = buildGameDetailFixture();
    render(<WnbaTeamStatsCard detail={withStats} />);

    expect(screen.getByTestId("wnba-team-stats-card")).toBeInTheDocument();
    expect(screen.getByText("Team Stats")).toBeInTheDocument();
    expect(screen.getByText("Field goal %")).toBeInTheDocument();
    expect(screen.getByText("41")).toBeInTheDocument();
    expect(screen.getByText("49")).toBeInTheDocument();
  });

  it("highlights the leading value with a team-color pill", () => {
    const withStats = buildGameDetailFixture();
    render(<WnbaTeamStatsCard detail={withStats} />);

    const pill = screen.getByLabelText("Field goal % home leader");
    expect(pill).toHaveTextContent("49");
    expect(pill).toHaveClass("rounded-full");
    expect(pill).toHaveStyle({
      backgroundColor: withStats.home.color,
    });
    expect(
      screen.queryByLabelText("Field goal % away leader"),
    ).not.toBeInTheDocument();
  });

  it("returns null when winProbability is missing", () => {
    const { container } = render(
      <WnbaTeamStatsCard detail={{ ...detail, winProbability: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
