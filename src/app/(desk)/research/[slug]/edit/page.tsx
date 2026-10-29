import { ArticleComposer } from "@/components/articles";

export default async function EditResearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  return <ArticleComposer type="RESEARCH" slug={slug} error={error} />;
}
