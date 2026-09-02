import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { appFromSearch, WnbaPropPicksHeader } from "./WnbaPropPicksHeader";

function renderHeader(path = "/wnba/prop_picks") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <WnbaPropPicksHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("appFromSearch", () => {
  it("defaults to prizepicks and accepts underdog", () => {
    expect(appFromSearch(null)).toBe("prizepicks");
    expect(appFromSearch("prizepicks")).toBe("prizepicks");
    expect(appFromSearch("underdog")).toBe("underdog");
    expect(appFromSearch("other")).toBe("prizepicks");
  });
});

describe("WnbaPropPicksHeader", () => {
  it("places Props on the left with league pills and no DFS tabs", () => {
    renderHeader();

    const heading = screen.getByRole("heading", { name: "Props" });
    expect(heading).toHaveClass("chrome-title");
    expect(heading.parentElement).toHaveClass("chrome-title-row");
    expect(screen.getByTestId("wnba-prop-picks-header")).toHaveClass(CHROME_TITLE_TOP);
    expect(
      screen.getByTestId("wnba-prop-picks-header").querySelector("div.rounded"),
    ).toBeNull();

    expect(
      screen.getByRole("navigation", { name: "Leagues" }),
    ).toBeInTheDocument();
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
        <MemoryRouter initialEntries={["/wnba/prop_picks"]}>
          <WnbaPropPicksHeader>
            <span>Team filter</span>
          </WnbaPropPicksHeader>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Team filter")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Props" })).toBeInTheDocument();
  });
});
