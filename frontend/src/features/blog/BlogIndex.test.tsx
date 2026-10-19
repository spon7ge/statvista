import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { BlogIndex } from "./BlogIndex";

describe("BlogIndex", () => {
  it("lists the Knicks post as text with no image block", () => {
    render(
      <MemoryRouter>
        <BlogIndex />
      </MemoryRouter>,
    );
    const card = screen.getByRole("link", {
      name: /when analytics lie/i,
    });
    expect(card).toHaveAttribute(
      "href",
      "/blog/when-analytics-lie-2026-knicks",
    );
    expect(screen.getByText("Playoff Analytics")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "When Analytics Lie: How the 2026 Knicks Won It All",
      }),
    ).toBeInTheDocument();
    const excerpt = screen.getByText(/\?$/);
    expect(excerpt.textContent?.trim().endsWith("?")).toBe(true);
    expect(
      screen.getByText(
        "Quarter splits, clutch time, comebacks, and efficiency",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Jun 18, 2026")).toBeInTheDocument();
    const readTime = screen.getByText("8 min read");
    expect(readTime.className).toMatch(/rounded-full/);
    expect(readTime.className).toMatch(/bg-\[var\(--white\)\]/);
    expect(screen.queryByText("LINES")).not.toBeInTheDocument();
    expect(screen.queryByText("FORM")).not.toBeInTheDocument();
    const list = screen.getByTestId("blog-index-grid");
    expect(list.className).toMatch(/blog-content/);
    expect(list.className).toMatch(/grid-cols-1/);
    expect(list.className).toMatch(/sm:grid-cols-2/);
    expect(card.querySelector("[aria-hidden]")).toBeNull();
  });
});
