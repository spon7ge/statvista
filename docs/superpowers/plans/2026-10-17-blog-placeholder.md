# Blog Placeholder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/blog` with two placeholder posts (two per row) and `/blog/:slug` stub articles; wire sidebar Blog as a real link.

**Architecture:** Static TypeScript catalog in `features/blog`. Thin pages under `HomeChromeLayout` mirror About. Unknown slugs render `NotFoundPage`. No API/CMS.

**Tech Stack:** React 19, React Router 7, Vitest, Testing Library, Tailwind.

## Global Constraints

- Brand: **statvista**
- Exactly two posts; grid `grid-cols-1 sm:grid-cols-2`
- Card: accent color block + label, title, `{n} min read`
- No photo assets — solid/gradient CSS only
- Sidebar Blog is a `Link` (Settings stays a button)
- Update `md/system-design.md` page table for `/blog` and `/blog/:slug`
- Do not commit unless the user asks
- Do not touch unrelated dirty WIP files

---

## File structure

| File | Responsibility |
| --- | --- |
| `frontend/src/features/blog/posts.ts` | Catalog + `getPost(slug)` |
| `frontend/src/features/blog/BlogIndex.tsx` | Two-card grid |
| `frontend/src/features/blog/BlogPost.tsx` | Stub article body |
| `frontend/src/pages/BlogPage.tsx` | Index chrome |
| `frontend/src/pages/BlogPostPage.tsx` | Article chrome + slug |
| `frontend/src/app/AppRouter.tsx` | Routes |
| `frontend/src/features/home/AppSidebar.tsx` | Blog link |
| Tests alongside each feature/page touched | |
| `md/system-design.md` | Route table + chrome note |

---

### Task 1: Post catalog

**Files:**
- Create: `frontend/src/features/blog/posts.ts`
- Create: `frontend/src/features/blog/posts.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type BlogPost = {
    slug: string;
    title: string;
    readMinutes: number;
    accentLabel: string;
    accentClassName: string;
    body: string[];
  };
  export const BLOG_POSTS: readonly BlogPost[];
  export function getPost(slug: string): BlogPost | undefined;
  ```

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/features/blog/posts.test.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Implement catalog**

```ts
export type BlogPost = {
  slug: string;
  title: string;
  readMinutes: number;
  accentLabel: string;
  accentClassName: string;
  body: string[];
};

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: "read-a-prop-line",
    title: "How to read a prop line before you bet",
    readMinutes: 4,
    accentLabel: "LINES",
    accentClassName: "bg-gradient-to-br from-c2 to-c4 text-c5",
    body: [
      "Before you put money on a player prop, read the line the same way you’d read a box score: number first, then price, then sample.",
      "Compare the anchor book’s number to other books at the same line. A lonely number with no matches is a research flag, not a free lunch.",
      "Full article coming soon.",
    ],
  },
  {
    slug: "hit-rate-l5-l10-l15",
    title: "L5 / L10 / L15: what hit rate actually means",
    readMinutes: 6,
    accentLabel: "FORM",
    accentClassName: "bg-gradient-to-br from-c3 to-c2 text-c5",
    body: [
      "L5, L10, and L15 are recent hit rates against that line — useful form, not destiny.",
      "Small windows swing hard on one blow-up game. Pair them with H2H and the actual minutes or role you expect tonight.",
      "Full article coming soon.",
    ],
  },
] as const;

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
```

If `from-c2` / `to-c4` / `text-c5` are not valid in this project’s Tailwind theme, swap to existing utility classes already used on About/chrome (e.g. `bg-c2`, `text-c3`) — keep two visually distinct blocks.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/features/blog/posts.test.ts`

Expected: PASS

- [ ] **Step 5: Commit only if the user asks**

---

### Task 2: Index page, routes, sidebar

**Files:**
- Create: `frontend/src/features/blog/BlogIndex.tsx`
- Create: `frontend/src/features/blog/BlogIndex.test.tsx`
- Create: `frontend/src/pages/BlogPage.tsx`
- Modify: `frontend/src/app/AppRouter.tsx`
- Modify: `frontend/src/features/home/AppSidebar.tsx`
- Modify: `frontend/src/features/home/AppSidebar.test.tsx`
- Modify: `frontend/src/app/AppRouter.test.tsx` (add Blog; fix stale About “what you can do” assertion to match current About)

**Interfaces:**
- Consumes: `BLOG_POSTS` from `posts.ts`
- Produces: `BlogIndex`, `BlogPage`

- [ ] **Step 1: Write BlogIndex failing test**

```tsx
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
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd frontend && npm test -- src/features/blog/BlogIndex.test.tsx`

- [ ] **Step 3: Implement BlogIndex + BlogPage**

`BlogIndex.tsx`:

```tsx
import { Link } from "react-router-dom";
import { BLOG_POSTS } from "./posts";

export function BlogIndex() {
  return (
    <ul
      data-testid="blog-index-grid"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2"
    >
      {BLOG_POSTS.map((post) => (
        <li key={post.slug}>
          <Link
            to={`/blog/${post.slug}`}
            className="group flex flex-col gap-3 focus-visible:outline focus-visible:outline-2"
          >
            <div
              className={`flex aspect-[16/10] items-center justify-center rounded-sm text-sm font-semibold tracking-wide ${post.accentClassName}`}
              aria-hidden="true"
            >
              {post.accentLabel}
            </div>
            <h2 className="text-lg font-medium group-hover:underline">
              {post.title}
            </h2>
            <p className="text-[14px] text-c3">{post.readMinutes} min read</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

`BlogPage.tsx` (mirror AboutPage chrome):

```tsx
import { CHROME_PAGE_X, CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { BlogIndex } from "@/features/blog/BlogIndex";

export function BlogPage() {
  return (
    <div className="space-y-0 pb-8">
      <section className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X}`}>
        <div
          data-testid="blog-header"
          className={`relative z-20 flex flex-col gap-4 ${CHROME_TITLE_TOP}`}
        >
          <div className="chrome-title-row">
            <h1 className="chrome-title">Blog</h1>
          </div>
        </div>
        <BlogIndex />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Wire router + sidebar**

In `AppRouter.tsx`, import `BlogPage` and add inside `HomeChromeLayout`:

```tsx
<Route path="/about" element={<AboutPage />} />
<Route path="/blog" element={<BlogPage />} />
```

In `AppSidebar.tsx`, replace the Blog button with:

```tsx
<Link
  to="/blog"
  aria-current={
    pathname === "/blog" || pathname.startsWith("/blog/")
      ? "page"
      : undefined
  }
  className={rowClass(
    pathname === "/blog" || pathname.startsWith("/blog/"),
  )}
>
  <IconNewspaper />
  Blog
</Link>
```

- [ ] **Step 5: Update sidebar + AppRouter tests**

`AppSidebar.test.tsx`:
- Expect Blog `link` href `/blog` (not button)
- Icon shape helper: `svgMarkup("Blog")` or `svgMarkup("Blog", "link")` as appropriate
- Add: marks Blog current on `/blog` and `/blog/read-a-prop-line`

`AppRouter.test.tsx`:
- Add: renders Blog at `/blog` with heading Blog and both post titles
- Fix About test: remove assertion for “what you can do”; assert tech stack / description instead

- [ ] **Step 6: Run focused tests — expect PASS**

```bash
cd frontend && npm test -- \
  src/features/blog/BlogIndex.test.tsx \
  src/features/home/AppSidebar.test.tsx \
  src/app/AppRouter.test.tsx
```

- [ ] **Step 7: Commit only if the user asks**

---

### Task 3: Article page + unknown slug

**Files:**
- Create: `frontend/src/features/blog/BlogPost.tsx`
- Create: `frontend/src/features/blog/BlogPost.test.tsx`
- Create: `frontend/src/pages/BlogPostPage.tsx`
- Modify: `frontend/src/app/AppRouter.tsx`
- Modify: `frontend/src/app/AppRouter.test.tsx`

**Interfaces:**
- Consumes: `getPost`, `BlogPost` type
- Produces: `BlogPost` component, `BlogPostPage`

- [ ] **Step 1: Write BlogPost + router tests**

`BlogPost.test.tsx`:

```tsx
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
```

In `AppRouter.test.tsx` add:

```tsx
it("renders a blog post at /blog/:slug", () => {
  renderWithProviders(["/blog/read-a-prop-line"]);
  expect(
    screen.getByRole("heading", {
      name: /how to read a prop line before you bet/i,
    }),
  ).toBeInTheDocument();
});

it("renders not found for unknown blog slug", () => {
  renderWithProviders(["/blog/does-not-exist"]);
  expect(
    screen.getByRole("heading", { name: /page not found/i }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement BlogPost + BlogPostPage + route**

`BlogPost.tsx`:

```tsx
import { Link } from "react-router-dom";
import type { BlogPost as BlogPostModel } from "./posts";

export function BlogPost({ post }: { post: BlogPostModel }) {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div
        className={`flex aspect-[16/10] max-w-xl items-center justify-center rounded-sm text-sm font-semibold tracking-wide ${post.accentClassName}`}
        aria-hidden="true"
      >
        {post.accentLabel}
      </div>
      <header className="space-y-2">
        <h1 className="text-2xl font-medium">{post.title}</h1>
        <p className="text-[14px] text-c3">{post.readMinutes} min read</p>
      </header>
      <div className="space-y-4">
        {post.body.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
      </div>
      <p>
        <Link to="/blog" className="text-c4 hover:underline">
          Back to blog
        </Link>
      </p>
    </article>
  );
}
```

`BlogPostPage.tsx`:

```tsx
import { useParams } from "react-router-dom";
import { CHROME_PAGE_X, CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { BlogPost } from "@/features/blog/BlogPost";
import { getPost } from "@/features/blog/posts";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function BlogPostPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const post = getPost(slug);
  if (!post) {
    return <NotFoundPage />;
  }
  return (
    <div className="space-y-0 pb-8">
      <section className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X}`}>
        <div
          data-testid="blog-header"
          className={`relative z-20 flex flex-col gap-4 ${CHROME_TITLE_TOP}`}
        >
          <div className="chrome-title-row">
            <h1 className="chrome-title">Blog</h1>
          </div>
        </div>
        <BlogPost post={post} />
      </section>
    </div>
  );
}
```

Router (inside chrome, after `/blog`):

```tsx
<Route path="/blog/:slug" element={<BlogPostPage />} />
```

- [ ] **Step 4: Run focused tests — expect PASS**

```bash
cd frontend && npm test -- \
  src/features/blog/ \
  src/app/AppRouter.test.tsx \
  src/features/home/AppSidebar.test.tsx
```

- [ ] **Step 5: Commit only if the user asks**

---

### Task 4: system-design docs

**Files:**
- Modify: `md/system-design.md` — only Blog-related lines if the file has unrelated WIP (surgical edit)

- [ ] **Step 1: Update chrome note** so Site card says About and Blog route; Settings remains placeholder

- [ ] **Step 2: Add route tree lines** near `/about`:

```
/about               AboutPage
/blog                BlogPage
/blog/:slug          BlogPostPage
```

- [ ] **Step 3: Add table rows** after `/about`:

```md
| `/blog` | Placeholder blog index (2 posts / row: title, accent block, read time); sidebar Site link | — | none | `BlogPage` / `BlogIndex`; static catalog |
| `/blog/:slug` | Placeholder article; unknown slug → NotFound | — | none | `BlogPostPage` / `BlogPost`; `getPost` |
```

- [ ] **Step 4: Commit only if the user asks**

---

## Plan self-review

1. **Spec coverage:** Index 2×2 grid fields, article pages, sidebar link, NotFound, system-design, tests — Tasks 1–4.
2. **Placeholders:** None; accent classes may need theme swap noted in Task 1.
3. **Type consistency:** `BlogPost` type name vs component `BlogPost` — component file uses import alias `BlogPost as BlogPostModel` in the plan.
