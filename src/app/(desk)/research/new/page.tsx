import { ArticleComposer } from "@/components/articles";

export const metadata = { title: "New research article" };

export default async function NewResearchPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <ArticleComposer type="RESEARCH" error={error} />;
}
