import { ArticleIndex } from "@/components/articles";

export const metadata = { title: "Weekly market review" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <ArticleIndex type="MARKET_REVIEW" error={error} />;
}
