import { describe, expect, it } from "vitest";
import { BLOG_POSTS, getPost } from "./posts";

describe("blog posts catalog", () => {
  it("exposes exactly two posts with required fields", () => {
    expect(BLOG_POSTS).toHaveLength(2);
    for (const post of BLOG_POSTS) {
      expect(post.slug.length).toBeGreaterThan(0);
      expect(post.title.length).toBeGreaterThan(0);
      expect(post.readMinutes).toBeGreaterThan(0);
      expect(post.accentLabel.length).toBeGreaterThan(0);
      expect(post.accentClassName.length).toBeGreaterThan(0);
      expect(post.body.length).toBeGreaterThan(0);
    }
  });

  it("looks up by slug and misses unknown", () => {
    expect(getPost("read-a-prop-line")?.title).toMatch(/prop line/i);
    expect(getPost("hit-rate-l5-l10-l15")?.title).toMatch(/hit rate/i);
    expect(getPost("missing")).toBeUndefined();
  });
});
