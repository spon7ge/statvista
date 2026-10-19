import { Link } from "react-router-dom";
import { BLOG_POSTS, formatBlogDate } from "./posts";

export function BlogIndex() {
  return (
    <ul
      data-testid="blog-index-grid"
      className="blog-content grid grid-cols-1 gap-6 sm:grid-cols-2"
    >
      {BLOG_POSTS.map((post) => (
        <li key={post.slug} className="h-full">
          <Link
            to={`/blog/${post.slug}`}
            className="group flex h-full flex-col gap-2 rounded-lg border border-line p-4 focus-visible:outline focus-visible:outline-2"
          >
            <p className="text-sm font-medium text-c4">{post.category}</p>
            <h2 className="text-lg font-semibold group-hover:underline">
              {post.title}
            </h2>
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
          </Link>
        </li>
      ))}
    </ul>
  );
}
