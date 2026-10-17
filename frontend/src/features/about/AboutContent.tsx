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
