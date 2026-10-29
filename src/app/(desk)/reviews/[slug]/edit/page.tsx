import { ArticleComposer } from "@/components/articles";

export default async function EditReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  return <ArticleComposer type="MARKET_REVIEW" slug={slug} error={error} />;
}
