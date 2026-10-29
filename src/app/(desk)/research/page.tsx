import { ArticleIndex } from "@/components/articles";

export const metadata = { title: "Weekly research articles" };

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <ArticleIndex type="RESEARCH" error={error} />;
}
