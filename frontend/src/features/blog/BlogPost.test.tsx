import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { getPost } from "./posts";
import { BlogPost } from "./BlogPost";

describe("BlogPost", () => {
  it("renders the post without an image block", () => {
    const post = getPost("when-analytics-lie-2026-knicks")!;
    render(
      <MemoryRouter>
        <BlogPost post={post} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: post.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Playoff Analytics")).toBeInTheDocument();
    expect(screen.getByText(post.excerpt)).toBeInTheDocument();
    expect(screen.getByText(post.topics)).toBeInTheDocument();
    expect(screen.getByText("Jun 18, 2026")).toBeInTheDocument();
    const readTime = screen.getByText("8 min read");
    expect(readTime.className).toMatch(/rounded-full/);
    expect(readTime.className).toMatch(/bg-\[var\(--white\)\]/);
    expect(screen.getByText(post.body[0])).toBeInTheDocument();
    expect(screen.queryByText("LINES")).not.toBeInTheDocument();
    expect(document.querySelector("[aria-hidden]")).toBeNull();
    expect(screen.getByRole("link", { name: /back to blog/i })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("article").className).toMatch(/blog-content/);
  });
});
