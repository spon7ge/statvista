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

  it("returns null when winProbability is missing", () => {
    const { container } = render(
      <WnbaTeamStatsCard detail={{ ...detail, winProbability: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
