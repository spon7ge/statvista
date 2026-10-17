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
