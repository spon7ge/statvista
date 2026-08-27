import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HomeChromeLayout } from "./HomeChromeLayout";

describe("HomeChromeLayout", () => {
  it("renders sidebar and footer without a live ticker", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/" element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(screen.queryByText("No live games")).not.toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(
      screen.getByText(/informational and entertainment purposes only/i),
    ).toBeInTheDocument();
  });

  it("puts a primary sidebar beside the page, not HomeNav", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/" element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
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
    render(
      <MemoryRouter initialEntries={["/wnba/matchups"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/wnba/matchups" element={<div>matchups</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const bar = screen.getByRole("banner");
    expect(bar).toHaveClass("sm:hidden");
    expect(within(bar).getByRole("link", { name: "statvista" })).toHaveAttribute(
      "href",
      "/",
    );

    const open = screen.getByRole("button", { name: "Open menu" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();

    await user.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    const drawer = document.getElementById("app-sidebar-drawer");
    expect(drawer).toBeTruthy();
    expect(within(drawer!).getByRole("link", { name: "WNBA" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
    expect(open).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the drawer after navigating a sidebar link", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/" element={<div>home</div>} />
            <Route path="/wnba/matchups" element={<div>matchups</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("app-sidebar-drawer");
    await user.click(within(drawer!).getByRole("link", { name: "WNBA" }));
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
    expect(screen.getByText("matchups")).toBeInTheDocument();
  });
});
