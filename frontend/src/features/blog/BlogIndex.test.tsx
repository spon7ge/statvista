import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { BlogIndex } from "./BlogIndex";

describe("BlogIndex", () => {
  it("renders two post cards with title, read time, and links", () => {
    render(
      <MemoryRouter>
        <BlogIndex />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: /how to read a prop line/i }),
    ).toHaveAttribute("href", "/blog/read-a-prop-line");
    expect(
      screen.getByRole("link", { name: /hit rate actually means/i }),
    ).toHaveAttribute("href", "/blog/hit-rate-l5-l10-l15");
    expect(screen.getByText("4 min read")).toBeInTheDocument();
    expect(screen.getByText("6 min read")).toBeInTheDocument();
    expect(screen.getByText("LINES")).toBeInTheDocument();
    expect(screen.getByText("FORM")).toBeInTheDocument();
    const grid = screen.getByTestId("blog-index-grid");
    expect(grid.className).toMatch(/sm:grid-cols-2/);
  });
});
