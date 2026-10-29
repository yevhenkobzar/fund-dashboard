import { ArticleReader } from "@/components/articles";

export default async function ResearchArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArticleReader type="RESEARCH" slug={slug} />;
}
