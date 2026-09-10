import { CHROME_PAGE_X, CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { AboutContent } from "@/features/about/AboutContent";

export function AboutPage() {
  return (
    <div className="space-y-0 pb-8">
      <section className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X}`}>
        <div
          data-testid="about-header"
          className={`relative z-20 flex flex-col gap-4 ${CHROME_TITLE_TOP}`}
        >
          <div className="chrome-title-row">
            <h1 className="chrome-title">About</h1>
          </div>
        </div>
        <AboutContent />
      </section>
    </div>
  );
}
