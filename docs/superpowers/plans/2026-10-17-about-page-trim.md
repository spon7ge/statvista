# About Page Trim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slim `/about` to a short product description plus the existing tech stack block; remove disclaimer, “What you can do”, and data sources.

**Architecture:** Keep `AboutPage` → `AboutContent`. Edit static copy in `AboutContent.tsx` only. Update the existing Vitest file to match the new surface. No routing or chrome changes.

**Tech Stack:** React 19, Vitest, Testing Library (frontend package scripts).

## Global Constraints

- Brand: **statvista** (never HoopVista / hoopvista)
- Description + Tech stack only; no gamble-responsibly disclaimer
- Exact description copy from spec (verbatim)
- Tech stack line unchanged from current page
- No backend / route / sidebar changes
- Do not commit unless the user explicitly asks

---

## File structure

| File | Responsibility |
| --- | --- |
| `frontend/src/features/about/AboutContent.tsx` | Static About body |
| `frontend/src/features/about/AboutContent.test.tsx` | Surface assertions |
| `frontend/src/pages/AboutPage.tsx` | Unchanged chrome wrapper |

---

### Task 1: Trim AboutContent (TDD)

**Files:**
- Modify: `frontend/src/features/about/AboutContent.test.tsx`
- Modify: `frontend/src/features/about/AboutContent.tsx`
- Test: `frontend/src/features/about/AboutContent.test.tsx`

**Interfaces:**
- Consumes: none (static component)
- Produces: `export function AboutContent(): JSX.Element` with description + tech stack only

- [ ] **Step 1: Rewrite the failing test**

Replace the body of `AboutContent.test.tsx` with:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AboutContent } from "./AboutContent";

describe("AboutContent", () => {
  it("renders description and tech stack only", () => {
    render(<AboutContent />);

    expect(screen.getByText(/statvista/i)).toBeInTheDocument();
    expect(
      screen.getByText(/make pre-bet research easier/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/players, lines, and upcoming games/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /tech stack/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/react 19/i)).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: /what you can do/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /data sources/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/gamble responsibly/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /espn/i }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/features/about/AboutContent.test.tsx`

Expected: FAIL — old copy still has data sources / “What you can do” / missing new description phrases.

- [ ] **Step 3: Write minimal implementation**

Replace `AboutContent.tsx` entirely with:

```tsx
export function AboutContent() {
  return (
    <div className="about-content max-w-3xl space-y-10">
      <div className="space-y-4">
        <p>
          I built <strong className="text-c3">statvista</strong> to make
          pre-bet research easier. It puts the sites I’d normally jump between
          into one place so you can look up players, lines, and upcoming games
          without hopping around.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="about-stack">
        <h2 id="about-stack">Tech stack</h2>
        <p>
          React 19, Vite, TanStack Query, Tailwind · FastAPI + Pydantic ·
          Postgres (Supabase or local)
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/features/about/AboutContent.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit only if the user asks**

If asked:

```bash
git add frontend/src/features/about/AboutContent.tsx \
  frontend/src/features/about/AboutContent.test.tsx \
  docs/superpowers/specs/2026-10-17-about-page-trim-design.md \
  docs/superpowers/plans/2026-10-17-about-page-trim.md
git commit -m "$(cat <<'EOF'
Slim About page to description and tech stack.

EOF
)"
```

---

## Plan self-review

1. **Spec coverage:** Description copy, tech stack kept, disclaimer/what/sources removed, tests updated — all in Task 1.
2. **Placeholders:** None.
3. **Type consistency:** Single component export unchanged.
