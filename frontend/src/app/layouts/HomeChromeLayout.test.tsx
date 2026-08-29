import { describe, expect, it, vi } from "vitest";
import { type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomeChromeLayout } from "./HomeChromeLayout";

vi.mock("@/features/home/lib/prefetchPropsBoard", () => ({
  prefetchPropsBoard: vi.fn(),
}));

function renderChrome(ui: ReactNode, path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HomeChromeLayout", () => {
  it("renders sidebar and footer without a live ticker", () => {
    renderChrome(
      <Routes>
        <Route element={<HomeChromeLayout />}>
          <Route path="/" element={<div>home</div>} />
        </Route>
      </Routes>,
      "/",
    );
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(screen.queryByText("No live games")).not.toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(
      screen.getByText(/informational and entertainment purposes only/i),
    ).toBeInTheDocument();
  });

  it("puts a primary sidebar beside the page, not HomeNav", () => {
    const { container } = renderChrome(
      <Routes>
        <Route element={<HomeChromeLayout />}>
          <Route path="/" element={<div>home</div>} />
        </Route>
      </Routes>,
      "/",
    );
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Games" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^leagues$/i }),
    ).not.toBeInTheDocument();

    const sidebar = screen.getByRole("navigation", { name: "Primary" }).closest(
      "aside",
    );
    expect(sidebar).toHaveClass("hidden", "sm:flex", "w-60");
    expect(sidebar).not.toHaveClass("border-r");
    const root = container.firstElementChild;
    expect(root).toHaveClass("sm:flex-row");
  });

  it("opens a mobile drawer from the hamburger and closes on Escape", async () => {
    const user = userEvent.setup();
    renderChrome(
      <Routes>
        <Route element={<HomeChromeLayout />}>
          <Route path="/wnba/matchups" element={<div>matchups</div>} />
        </Route>
      </Routes>,
      "/wnba/matchups",
    );

    const bar = screen.getByRole("banner");
    expect(bar).toHaveClass("sm:hidden");
    expect(within(bar).getByRole("link", { name: "statvista" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );

    const open = screen.getByRole("button", { name: "Open menu" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();

    await user.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    const drawer = document.getElementById("app-sidebar-drawer");
    expect(drawer).toBeTruthy();
    expect(within(drawer!).getByRole("link", { name: "Games" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
    expect(open).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the drawer after navigating a sidebar link", async () => {
    const user = userEvent.setup();
    renderChrome(
      <Routes>
        <Route element={<HomeChromeLayout />}>
          <Route path="/" element={<div>home</div>} />
          <Route path="/mlb/matchups" element={<div>matchups</div>} />
        </Route>
      </Routes>,
      "/",
    );
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("app-sidebar-drawer");
    await user.click(within(drawer!).getByRole("link", { name: "Games" }));
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
    expect(screen.getByText("matchups")).toBeInTheDocument();
  });
});
