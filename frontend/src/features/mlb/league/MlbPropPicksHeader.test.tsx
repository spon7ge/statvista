import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { MlbPropPicksHeader } from "./MlbPropPicksHeader";

function renderHeader(path = "/mlb/prop_picks") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <MlbPropPicksHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MlbPropPicksHeader", () => {
  it("places Props on the left with league pills and no DFS tabs", () => {
    renderHeader();

    const heading = screen.getByRole("heading", { name: "Props" });
    expect(heading).toHaveClass("chrome-title");
    expect(heading.parentElement).toHaveClass("chrome-title-row");
    expect(screen.getByTestId("mlb-prop-picks-header")).toHaveClass(CHROME_TITLE_TOP);
    expect(
      screen.getByTestId("mlb-prop-picks-header").querySelector("div.rounded"),
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
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/mlb/prop_picks"]}>
          <MlbPropPicksHeader>
            <span>Team filter</span>
          </MlbPropPicksHeader>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Team filter")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Props" })).toBeInTheDocument();
  });
});
