import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MlbPropPicksHeader } from "./MlbPropPicksHeader";

function renderHeader(path = "/mlb/prop_picks") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MlbPropPicksHeader />
    </MemoryRouter>,
  );
}

describe("MlbPropPicksHeader", () => {
  it("places Props on the left with league pills and no DFS tabs", () => {
    renderHeader();

    const heading = screen.getByRole("heading", { name: "Props" });
    expect(heading).toHaveClass("text-left", "text-[28px]", "font-bold");
    expect(
      screen.getByTestId("mlb-prop-picks-header").querySelector("div.rounded-3xl"),
    ).toBeNull();

    const leagues = screen.getByRole("navigation", { name: "Leagues" });
    expect(within(leagues).getByRole("link", { name: "MLB" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(leagues).getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/prop_picks",
    );
    expect(within(leagues).getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/prop_picks",
    );
    expect(within(leagues).queryByRole("link", { name: "NBA" })).not.toBeInTheDocument();
    expect(within(leagues).getByRole("button", { name: "NBA" })).toBeDisabled();

    expect(screen.queryByRole("tab", { name: "PrizePicks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Underdog" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText(/-pick/)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Legs" })).not.toBeInTheDocument();
  });

  it("renders filter children under the league switcher", () => {
    render(
      <MemoryRouter initialEntries={["/mlb/prop_picks"]}>
        <MlbPropPicksHeader>
          <span>Team filter</span>
        </MlbPropPicksHeader>
      </MemoryRouter>,
    );
    expect(screen.getByText("Team filter")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Props" })).toBeInTheDocument();
  });
});
