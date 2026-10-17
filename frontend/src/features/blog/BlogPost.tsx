import { Link } from "react-router-dom";
import type { BlogPost as BlogPostModel } from "./posts";

export function BlogPost({ post }: { post: BlogPostModel }) {
  return (
    <article className="blog-content mx-auto max-w-3xl space-y-6">
      <div
        className={`flex aspect-[16/10] max-w-xl items-center justify-center rounded-md text-sm font-semibold tracking-wide ${post.accentClassName}`}
        aria-hidden="true"
      >
        {post.accentLabel}
      </div>
      <header className="space-y-2">
        <h1 className="text-2xl font-medium">{post.title}</h1>
        <span className="inline-flex w-fit rounded-full bg-[var(--white)] px-2.5 py-0.5 text-[14px] font-medium text-c1">
          {post.readMinutes} min read
        </span>

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
