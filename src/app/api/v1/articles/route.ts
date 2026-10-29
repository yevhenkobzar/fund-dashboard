import { createAgentDraft } from "@/lib/articles/api";
import { plainExcerpt, slugify } from "@/lib/articles/text";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  const result = await createAgentDraft({
    authorization: request.headers.get("authorization"),
    payload,
    pepper: process.env.AUTH_SECRET ?? "",
    lookup: async (hash) => {
      const row = await prisma.apiToken.findUnique({ where: { tokenHash: hash } });
      if (!row) return null;
      return { id: row.id, revoked: Boolean(row.revokedAt), createdById: row.createdById };
    },
    touch: async (id) => {
      await prisma.apiToken.update({ where: { id }, data: { lastUsedAt: new Date() } });
    },
    create: async (article) => {
      const base = slugify(article.title);
      let slug = base;
      let n = 2;
      while (await prisma.article.findUnique({ where: { type_slug: { type: article.type, slug } } })) {
        slug = `${base}-${n}`;
        n += 1;
      }
      const created = await prisma.article.create({
        data: {
          type: article.type,
          title: article.title,
          slug,
          excerpt: article.excerpt ?? plainExcerpt(article.content),
          content: article.content,
          status: "DRAFT",
          authorId: article.authorId,
        },
      });
      await prisma.auditEvent.create({
        data: {
          actorId: article.authorId,
          action: "create",
          entityType: "article",
          entityId: created.id,
          summary: `Agent draft created: ${article.title}`,
        },
      });
      return { id: created.id, slug: created.slug, type: created.type };
    },
  });
  return Response.json(result.body, { status: result.status });
}
