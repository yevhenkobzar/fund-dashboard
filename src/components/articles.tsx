import Link from "next/link";
import { notFound } from "next/navigation";
import type { ArticleType } from "@prisma/client";
import { authorize, canReadArticle } from "@/lib/auth/permissions";
import { SECTIONS } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ArticleEditor } from "@/components/article-editor";
import { MarkdownView } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flash, PageHeader } from "@/components/page-header";
import { requireAction, requireUser } from "@/server/guard";

export async function ArticleIndex({ type, error }: { type: ArticleType; error?: string }) {
  const user = await requireUser();
  const section = SECTIONS[type];
  const canWrite = authorize(user.role, "write_article");
  const articles = await prisma.article.findMany({
    where: { type, ...(canWrite ? {} : { status: "PUBLISHED" }) },
    include: { author: { select: { name: true, email: true } } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return (
    <div>
      <PageHeader
        kicker={section.kicker}
        title={section.title}
        description={section.description}
        action={canWrite ? <Button asChild><Link href={`${section.href}/new`}>New article</Link></Button> : null}
      />
      <Flash error={error} />
      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{canWrite ? "No articles yet. Draft the first one." : section.empty}</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {articles.map((article) => (
            <Link key={article.id} href={`${section.href}/${article.slug}`} className="block px-4 py-4 hover:bg-accent/60">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-2xl">{article.title}</h2>
                {article.status === "DRAFT" ? <Badge>Draft</Badge> : null}
                {article.isExample ? <Badge>Example</Badge> : null}
              </div>
              {article.excerpt ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{article.excerpt}</p> : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {article.author.name || article.author.email}
                {" · "}
                {article.publishedAt ? formatDate(article.publishedAt) : `Updated ${formatDate(article.updatedAt)}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export async function ArticleReader({ type, slug }: { type: ArticleType; slug: string }) {
  const user = await requireUser();
  const section = SECTIONS[type];
  const article = await prisma.article.findUnique({
    where: { type_slug: { type, slug } },
    include: { author: { select: { name: true, email: true } } },
  });
  if (!article || !canReadArticle(user.role, article.status)) notFound();
  const canWrite = authorize(user.role, "write_article");
  return (
    <article className="mx-auto max-w-3xl">
      <Link href={section.href} className="text-sm text-primary">Back to {section.nav.toLowerCase()}</Link>
      <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-brass">{section.kicker}</p>
      <h1 className="mt-1 font-serif text-4xl tracking-tight">{article.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {article.author.name || article.author.email}
        {" · "}
        {article.status === "PUBLISHED" && article.publishedAt ? formatDate(article.publishedAt) : "Draft"}
        {article.isExample ? " · Example" : ""}
      </p>
      {canWrite ? (
        <div className="mt-4">
          <Button asChild variant="secondary" size="sm"><Link href={`${section.href}/${article.slug}/edit`}>Edit</Link></Button>
        </div>
      ) : null}
      <div className="mt-8">
        <MarkdownView content={article.content} />
      </div>
    </article>
  );
}

export async function ArticleComposer({
  type,
  slug,
  error,
}: {
  type: ArticleType;
  slug?: string;
  error?: string;
}) {
  await requireAction("write_article");
  const section = SECTIONS[type];
  const article = slug
    ? await prisma.article.findUnique({ where: { type_slug: { type, slug } } })
    : null;
  if (slug && !article) notFound();
  return (
    <div>
      <PageHeader
        kicker={section.kicker}
        title={article ? "Edit article" : "New article"}
        description="Markdown. Save a draft or publish it for viewers."
      />
      <Flash error={error} />
      <ArticleEditor
        id={article?.id}
        type={type}
        title={article?.title}
        excerpt={article?.excerpt ?? ""}
        content={article?.content}
        published={article?.status === "PUBLISHED"}
      />
    </div>
  );
}
