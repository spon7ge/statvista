import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { LeagueLegsPage } from "./LeagueLegsPage";

function renderPage(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <LeagueLegsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeagueLegsPage", () => {
  it("renders an empty Legs shell with league pills", () => {
    renderPage("/mlb/legs");
    expect(screen.getByRole("heading", { name: "Legs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/legs",
    );
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/legs",
    );
    expect(screen.getByRole("button", { name: "NBA" })).toBeDisabled();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
