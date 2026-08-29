import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { PropPicksLeagueSwitcher } from "./PropPicksLeagueSwitcher";

function renderSwitcher(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <PropPicksLeagueSwitcher />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PropPicksLeagueSwitcher", () => {
  it("marks MLB current on the MLB board and links WNBA", () => {
    renderSwitcher("/mlb/prop_picks");
    const leagues = screen.getByRole("navigation", { name: "Leagues" });
    expect(within(leagues).getByRole("link", { name: "MLB" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(leagues).getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/prop_picks",
    );
    expect(within(leagues).getByRole("button", { name: "NBA" })).toBeDisabled();
  });

  it("marks WNBA current on the WNBA board", () => {
    renderSwitcher("/wnba/prop_picks");
    const leagues = screen.getByRole("navigation", { name: "Leagues" });
    expect(within(leagues).getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(leagues).getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/prop_picks",
    );
  });
});
