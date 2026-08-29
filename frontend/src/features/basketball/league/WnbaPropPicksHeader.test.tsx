import { type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { appFromSearch, WnbaPropPicksHeader } from "./WnbaPropPicksHeader";

function renderHeader(ui: ReactElement, path = "/wnba/prop_picks") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
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
  it("places Props on the left with league pills and DFS tabs", async () => {
    const user = userEvent.setup();
    const onAppChange = vi.fn();
    renderHeader(
      <WnbaPropPicksHeader activeApp="prizepicks" onAppChange={onAppChange} />,
    );

    const heading = screen.getByRole("heading", { name: "Props" });
    expect(heading).toHaveClass("text-left", "text-[28px]", "font-bold", "text-white");
    expect(screen.getByTestId("wnba-prop-picks-header")).toHaveClass(CHROME_TITLE_TOP);
    expect(
      screen.getByTestId("wnba-prop-picks-header").querySelector("div.rounded-3xl"),
    ).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Leagues" }),
    ).toBeInTheDocument();

    const prize = screen.getByRole("tab", { name: "PrizePicks" });
    const underdog = screen.getByRole("tab", { name: "Underdog" });
    expect(prize).toHaveAttribute("aria-selected", "true");
    expect(underdog).toHaveAttribute("aria-selected", "false");

    await user.click(underdog);
    expect(onAppChange).toHaveBeenCalledWith("underdog");

    expect(screen.queryByText(/-pick/)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Legs" })).not.toBeInTheDocument();
  });

  it("keeps tab ids for panels", () => {
    renderHeader(
      <WnbaPropPicksHeader activeApp="prizepicks" onAppChange={vi.fn()} />,
    );

    expect(screen.getByRole("tab", { name: "PrizePicks" })).toHaveAttribute(
      "id",
      "wnba-props-prizepicks-tab",
    );
    expect(screen.getByRole("tab", { name: "Underdog" })).toHaveAttribute(
      "aria-controls",
      "wnba-props-underdog-panel",
    );
  });

  it("renders children under the league switcher", () => {
    renderHeader(
      <WnbaPropPicksHeader activeApp="prizepicks" onAppChange={vi.fn()}>
        <span>Team filter</span>
      </WnbaPropPicksHeader>,
    );
    expect(screen.getByText("Team filter")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Props" })).toBeInTheDocument();
  });
});
