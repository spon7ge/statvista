import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { getPost } from "./posts";
import { BlogPost } from "./BlogPost";

describe("BlogPost", () => {
  it("renders title, read time, accent, body, and back link", () => {
    const post = getPost("read-a-prop-line")!;
    render(
      <MemoryRouter>
        <BlogPost post={post} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: post.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("4 min read")).toBeInTheDocument();
    expect(screen.getByText("LINES")).toBeInTheDocument();
    expect(screen.getByText(/full article coming soon/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to blog/i })).toHaveAttribute(
      "href",
      "/blog",
    );
  });
});
