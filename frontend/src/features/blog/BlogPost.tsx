import { Link } from "react-router-dom";
import { formatBlogDate, type BlogPost as BlogPostModel } from "./posts";

export function BlogPost({ post }: { post: BlogPostModel }) {
  return (
    <article className="blog-content mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-c4">{post.category}</p>
        <h1 className="text-2xl font-semibold">{post.title}</h1>
        <p>{post.excerpt}</p>
        <p className="text-sm">{post.topics}</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <time dateTime={post.publishedOn}>
            {formatBlogDate(post.publishedOn)}
          </time>
          <span className="inline-flex w-fit rounded-full bg-[var(--white)] px-2.5 py-0.5 text-[14px] font-medium text-c1">
            {post.readMinutes} min read
          </span>
        </div>
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
