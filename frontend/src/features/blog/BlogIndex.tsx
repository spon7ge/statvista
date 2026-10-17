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
