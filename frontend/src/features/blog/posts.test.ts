import { describe, expect, it } from "vitest";
import { BLOG_POSTS, getPost } from "./posts";

describe("blog posts catalog", () => {
  it("lists the Knicks playoff post with list fields and no image", () => {
    expect(BLOG_POSTS).toHaveLength(1);
    const post = BLOG_POSTS[0];
    expect(post.slug).toBe("when-analytics-lie-2026-knicks");
    expect(post.category).toBe("Playoff Analytics");
    expect(post.title).toBe(
      "When Analytics Lie: How the 2026 Knicks Won It All",
    );
    expect(post.excerpt.endsWith("?")).toBe(true);
    expect(post.topics).toBe(
      "Quarter splits, clutch time, comebacks, and efficiency",
    );
    expect(post.publishedOn).toBe("2026-06-18");
    expect(post.readMinutes).toBe(8);
    expect(post.body.length).toBeGreaterThan(0);
    expect(post).not.toHaveProperty("accentLabel");
    expect(post).not.toHaveProperty("accentClassName");
  });

  it("looks up by slug and misses unknown", () => {
    expect(getPost("when-analytics-lie-2026-knicks")?.title).toMatch(
      /2026 Knicks/i,
    );
    expect(getPost("missing")).toBeUndefined();
  });
});
