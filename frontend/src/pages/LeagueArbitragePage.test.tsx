import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { LeagueArbitragePage } from "./LeagueArbitragePage";

function renderPage(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <LeagueArbitragePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeagueArbitragePage", () => {
  it("renders an empty Arbitrage shell with league pills", () => {
    renderPage("/mlb/arbitrage");
    expect(screen.getByRole("heading", { name: "Arbitrage" })).toHaveClass(
      "text-white",
    );
    expect(screen.getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/arbitrage",
    );
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/arbitrage",
    );
    expect(screen.getByRole("button", { name: "NBA" })).toBeDisabled();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
