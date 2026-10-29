import { sectionForApiType } from "@/lib/domain";
import { hashApiToken, readBearer } from "@/lib/auth/tokens";

export type AgentDraftInput = {
  type: "MARKET_REVIEW" | "RESEARCH";
  title: string;
  content: string;
  excerpt: string | null;
};

type TokenRecord = { id: string; revoked: boolean; createdById: string };

export async function createAgentDraft(input: {
  authorization: string | null;
  payload: unknown;
  pepper: string;
  lookup: (hash: string) => Promise<TokenRecord | null>;
  touch: (id: string) => Promise<void>;
  create: (article: AgentDraftInput & { authorId: string }) => Promise<{ id: string; slug: string; type: string }>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const plaintext = readBearer(input.authorization);
  if (!plaintext || !input.pepper) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  const record = await input.lookup(hashApiToken(plaintext, input.pepper));
  if (!record || record.revoked) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  if (!input.payload || typeof input.payload !== "object") {
    return { status: 400, body: { error: "Send a JSON object." } };
  }
  const body = input.payload as Record<string, unknown>;
  if (body.status === "published") {
    return { status: 400, body: { error: "Agents can create drafts only." } };
  }
  const section = typeof body.type === "string" ? sectionForApiType(body.type) : null;
  if (!section) {
    return { status: 400, body: { error: 'type must be "market_review" or "research".' } };
  }
  if (typeof body.title !== "string" || body.title.trim().length === 0 || body.title.trim().length > 200) {
    return { status: 400, body: { error: "title must be 1–200 characters." } };
  }
  if (typeof body.content !== "string" || body.content.trim().length === 0 || body.content.length > 100_000) {
    return { status: 400, body: { error: "content must be markdown, up to 100000 characters." } };
  }
  if (body.excerpt !== undefined && (typeof body.excerpt !== "string" || body.excerpt.length > 500)) {
    return { status: 400, body: { error: "excerpt must be 500 characters or fewer." } };
  }

  await input.touch(record.id);
  const created = await input.create({
    type: section.type,
    title: body.title.trim(),
    content: body.content,
    excerpt: typeof body.excerpt === "string" && body.excerpt.trim() ? body.excerpt.trim() : null,
    authorId: record.createdById,
  });
  return {
    status: 201,
    body: {
      id: created.id,
      slug: created.slug,
      status: "draft",
      type: section.apiType,
    },
  };
}
