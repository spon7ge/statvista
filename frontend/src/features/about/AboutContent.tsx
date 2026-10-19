export function AboutContent() {
  return (
    <div className="about-content max-w-3xl space-y-10">
      <div className="space-y-4">
        <p>
          I’m Alex Gonzalez, a data science graduate from Saint Mary’s College
          of California. I built <strong className="text-c3">statvista</strong>{" "}
          to help people research before they place a bet, or just look up
          stats.
        </p>
        <p>This is a research site. It is not gambling advice.</p>
      </div>

      <section className="space-y-3" aria-labelledby="about-stack">
        <h2 id="about-stack">Tech stack</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Frontend: React, Tailwind</li>
          <li>Backend: FastAPI, Supabase</li>
        </ul>
      </section>
    </div>
  );
}
