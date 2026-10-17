# Contact Page (UI Stub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/contact` with a Name / Subject / Description form UI; Send disabled with “Coming soon”; wire sidebar Contact as a link.

**Architecture:** Static React form under `HomeChromeLayout` (About/Blog chrome). No API, mailto, or submit handler.

**Tech Stack:** React 19, React Router 7, Vitest, Testing Library, Tailwind.

## Global Constraints

- Brand: **statvista**
- Fields: Name, Subject, Description (textarea)
- Send disabled + helper “Coming soon”
- No network / mailto / form action
- Public Sans via `.contact-content`
- Do not commit unless the user asks
- Do not touch unrelated dirty WIP

---

## File structure

| File | Responsibility |
| --- | --- |
| `frontend/src/features/contact/ContactForm.tsx` | Form stub |
| `frontend/src/features/contact/ContactForm.test.tsx` | Form assertions |
| `frontend/src/pages/ContactPage.tsx` | Chrome wrapper |
| `frontend/src/app/AppRouter.tsx` | `/contact` route |
| `frontend/src/features/home/AppSidebar.tsx` | Contact `Link` |
| Tests for sidebar + router | |
| `frontend/src/app/ui.css` | `.contact-content` |
| `md/system-design.md`, `README.md` | Contact routes; send not wired |

---

### Task 1: Contact form, page, route, sidebar

**Files:**
- Create: `frontend/src/features/contact/ContactForm.tsx`
- Create: `frontend/src/features/contact/ContactForm.test.tsx`
- Create: `frontend/src/pages/ContactPage.tsx`
- Modify: `frontend/src/app/ui.css` (add `.contact-content` mirroring `.about-content`)
- Modify: `frontend/src/app/AppRouter.tsx`
- Modify: `frontend/src/app/AppRouter.test.tsx`
- Modify: `frontend/src/features/home/AppSidebar.tsx`
- Modify: `frontend/src/features/home/AppSidebar.test.tsx`

**Interfaces:**
- Produces: `export function ContactForm(): JSX.Element`, `export function ContactPage(): JSX.Element`

- [ ] **Step 1: Write ContactForm failing test**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactForm } from "./ContactForm";

describe("ContactForm", () => {
  it("renders name, subject, description and a disabled send with coming soon", () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^subject$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^description$/i)).toBeInTheDocument();
    const send = screen.getByRole("button", { name: /^send$/i });
    expect(send).toBeDisabled();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.getByTestId("contact-form").className).toMatch(
      /contact-content/,
    );
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd frontend && npm test -- src/features/contact/ContactForm.test.tsx`

- [ ] **Step 3: Implement ContactForm + ContactPage + CSS**

Add to `ui.css` after `.blog-content` block:

```css
.contact-content {
  font-family: var(--font-ui);
  font-size: var(--text-16);
  font-weight: var(--font-weight-body);
  line-height: var(--lh-body);
  color: var(--c3);
}

.contact-content label {
  font-family: var(--font-ui);
  font-weight: 600;
}
```

`ContactForm.tsx`:

```tsx
const fieldClass =
  "w-full rounded border border-line bg-transparent px-3 py-2 text-[16px] text-c3 placeholder:text-muted";

export function ContactForm() {
  return (
    <form
      data-testid="contact-form"
      className="contact-content mx-auto max-w-xl space-y-5"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="space-y-2">
        <label htmlFor="contact-name">Name</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          className={fieldClass}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="contact-subject">Subject</label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          className={fieldClass}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="contact-description">Description</label>
        <textarea
          id="contact-description"
          name="description"
          rows={6}
          className={fieldClass}
        />
      </div>
      <div className="space-y-2">
        <button
          type="submit"
          disabled
          className="rounded border border-line px-4 py-2 text-[14px] font-semibold text-c3 opacity-50"
        >
          Send
        </button>
        <p className="text-[14px] text-c3">Coming soon</p>
      </div>
    </form>
  );
}
```

`ContactPage.tsx` (mirror AboutPage):

```tsx
import { CHROME_PAGE_X, CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { ContactForm } from "@/features/contact/ContactForm";

export function ContactPage() {
  return (
    <div className="space-y-0 pb-8">
      <section className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X}`}>
        <div
          data-testid="contact-header"
          className={`relative z-20 flex flex-col gap-4 ${CHROME_TITLE_TOP}`}
        >
          <div className="chrome-title-row">
            <h1 className="chrome-title">Contact</h1>
          </div>
        </div>
        <ContactForm />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Wire router + sidebar**

`AppRouter.tsx`: import `ContactPage`, add `<Route path="/contact" element={<ContactPage />} />` next to about/blog.

`AppSidebar.tsx`: replace Contact button with:

```tsx
<Link
  to="/contact"
  aria-current={pathname === "/contact" ? "page" : undefined}
  className={rowClass(pathname === "/contact")}
>
  <IconMail />
  Contact
</Link>
```

- [ ] **Step 5: Update tests**

`AppSidebar.test.tsx`:
- Expect Contact `link` href `/contact` (not button)
- Icon: `svgMarkup("Contact")` (link role default) still contains `m22 7-8.991`
- Add: marks Contact current on `/contact`

`AppRouter.test.tsx`:
- Add: renders Contact at `/contact` with heading Contact and Send disabled

- [ ] **Step 6: Run focused tests — expect PASS**

```bash
cd frontend && npm test -- \
  src/features/contact/ \
  src/features/home/AppSidebar.test.tsx \
  src/app/AppRouter.test.tsx
```

- [ ] **Step 7: Commit only if the user asks**

---

### Task 2: Docs

**Files:**
- Modify: `md/system-design.md` (surgical Blog/Contact-related only if WIP is messy)
- Modify: `README.md` Contact row

- [ ] **Step 1: system-design**

- Chrome: Contact routes to `/contact` (form UI; send not wired)
- Route tree: `/contact ContactPage`
- Table row after blog rows:

```md
| `/contact` | Contact form stub (name, subject, description); Send disabled — coming soon; sidebar Site link | — | none | `ContactPage` / `ContactForm`; no API |
```

- [ ] **Step 2: README**

Update Blog/Contact row: Contact is form UI stub (send not wired); Blog remains placeholder articles as already documented.

Example:

```md
| **Blog** | Placeholder posts |
| **Contact** | Form UI stub (send not wired) |
```

- [ ] **Step 3: Commit only if the user asks**

---

## Plan self-review

1. Spec coverage: route, nav, fields, disabled Send, Coming soon, docs — Tasks 1–2.
2. Placeholders: none.
3. No backend.
