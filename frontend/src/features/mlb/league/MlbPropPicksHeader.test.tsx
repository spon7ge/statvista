import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MlbPropPicksHeader } from "./MlbPropPicksHeader";

describe("MlbPropPicksHeader", () => {
  it("places MLB Props on the left without a green banner or DFS tabs", () => {
    render(<MlbPropPicksHeader />);

    const heading = screen.getByRole("heading", { name: "MLB Props" });
    expect(heading).toHaveClass("text-left", "text-[32px]", "sm:text-[36px]");
    expect(
      screen.getByTestId("mlb-prop-picks-header").querySelector("div.rounded-3xl"),
    ).toBeNull();

    expect(screen.queryByRole("tab", { name: "PrizePicks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Underdog" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText(/-pick/)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Legs" })).not.toBeInTheDocument();
  });

  it("renders filter children under the title", () => {
    render(
      <MlbPropPicksHeader>
        <span>Team filter</span>
      </MlbPropPicksHeader>,
    );
    expect(screen.getByText("Team filter")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MLB Props" })).toBeInTheDocument();
  });
});
