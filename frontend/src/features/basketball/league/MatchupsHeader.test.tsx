import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { MatchupsHeader } from "./MatchupsHeader";

function renderHeader(path = "/mlb/matchups") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <MatchupsHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MatchupsHeader", () => {
  it("places Matchups on the left with league pills for MLB, WNBA, and NBA", () => {
    renderHeader();

    const heading = screen.getByRole("heading", { name: "Matchups" });
    expect(heading).toHaveClass("text-left", "text-[28px]", "font-bold");
    expect(screen.getByTestId("matchups-header")).toHaveClass(CHROME_TITLE_TOP);

    const leagues = screen.getByRole("navigation", { name: "Leagues" });
    expect(within(leagues).getByRole("link", { name: "MLB" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(leagues).getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    expect(within(leagues).getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(within(leagues).getByRole("link", { name: "NBA" })).toHaveAttribute(
      "href",
      "/nba/matchups",
    );
  });

  it("marks WNBA current on the WNBA slate", () => {
    renderHeader("/wnba/matchups");
    const leagues = screen.getByRole("navigation", { name: "Leagues" });
    expect(within(leagues).getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
