import { ArticleReader } from "@/components/articles";

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArticleReader type="MARKET_REVIEW" slug={slug} />;
}
