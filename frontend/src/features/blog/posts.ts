export type BlogPost = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  topics: string;
  publishedOn: string;
  readMinutes: number;
  body: string[];
};

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: "when-analytics-lie-2026-knicks",
    category: "Playoff Analytics",
    title: "When Analytics Lie: How the 2026 Knicks Won It All",
    excerpt:
      "How did a 16–3 team with a +15.3 net rating spend most of the Finals trailing?",
    topics: "Quarter splits, clutch time, comebacks, and efficiency",
    publishedOn: "2026-06-18",
    readMinutes: 8,
    body: [
      "The 2026 Knicks won the title at 16–3 with a +15.3 net rating. Those numbers read like control.",
      "They trailed by 5 or more in 11 of 19 playoff games, and they spent 73% of the Finals clock behind San Antonio. The record never showed that.",
      "Quarter splits, clutch time, comebacks, and efficiency are where those season-long numbers stopped describing the games.",
    ],
  },
] as const;

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function formatBlogDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error(`Invalid blog date: ${isoDate}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
