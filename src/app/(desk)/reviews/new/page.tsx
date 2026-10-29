import { ArticleComposer } from "@/components/articles";

export const metadata = { title: "New market review" };

export default async function NewReviewPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <ArticleComposer type="MARKET_REVIEW" error={error} />;
}
