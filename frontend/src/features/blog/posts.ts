export type BlogPost = {
  slug: string;
  title: string;
  readMinutes: number;
  accentLabel: string;
  accentClassName: string;
  body: string[];
};

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: "read-a-prop-line",
    title: "How to read a prop line before you bet",
    readMinutes: 4,
    accentLabel: "LINES",
    accentClassName: "bg-gradient-to-br from-c2 to-c4 text-c5",
    body: [
      "Before you put money on a player prop, read the line the same way you’d read a box score: number first, then price, then sample.",
      "Compare the anchor book’s number to other books at the same line. A lonely number with no matches is a research flag, not a free lunch.",
      "Full article coming soon.",
    ],
  },
  {
    slug: "hit-rate-l5-l10-l15",
    title: "L5 / L10 / L15: what hit rate actually means",
    readMinutes: 6,
    accentLabel: "FORM",
    accentClassName: "bg-gradient-to-br from-c3 to-c2 text-c5",
    body: [
      "L5, L10, and L15 are recent hit rates against that line — useful form, not destiny.",
      "Small windows swing hard on one blow-up game. Pair them with H2H and the actual minutes or role you expect tonight.",
      "Full article coming soon.",
    ],
  },
] as const;

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
