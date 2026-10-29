import { describe, expect, it } from "vitest";
import { createAgentDraft } from "@/lib/articles/api";
import { generateApiToken, hashApiToken } from "@/lib/auth/tokens";

const pepper = "test-pepper-at-least-16";

describe("agent draft endpoint", () => {
  it("rejects missing, unknown, and revoked tokens", async () => {
    const { plaintext, hash } = generateApiToken(pepper);
    const lookup = async (candidate: string) => {
      if (candidate === hash) return { id: "tok", revoked: false, createdById: "admin" };
      if (candidate === hashApiToken("revoked-token", pepper)) {
        return { id: "old", revoked: true, createdById: "admin" };
      }
      return null;
    };
    expect((await createAgentDraft({
      authorization: null,
      payload: {},
      pepper,
      lookup,
      touch: async () => {},
      create: async () => ({ id: "a", slug: "a", type: "MARKET_REVIEW" }),
    })).status).toBe(401);

    expect((await createAgentDraft({
      authorization: `Bearer ${plaintext}nope`,
      payload: {},
      pepper,
      lookup,
      touch: async () => {},
      create: async () => ({ id: "a", slug: "a", type: "MARKET_REVIEW" }),
    })).status).toBe(401);

    expect((await createAgentDraft({
      authorization: "Bearer revoked-token",
      payload: {},
      pepper,
      lookup,
      touch: async () => {},
      create: async () => ({ id: "a", slug: "a", type: "MARKET_REVIEW" }),
    })).status).toBe(401);
  });

  it("creates a draft and refuses a publish request", async () => {
    const { plaintext, hash } = generateApiToken(pepper);
    let touched = false;
    let saved: { type: string; title: string } | null = null;
    const lookup = async (candidate: string) =>
      candidate === hash ? { id: "tok", revoked: false, createdById: "admin" } : null;

    const published = await createAgentDraft({
      authorization: `Bearer ${plaintext}`,
      payload: { type: "research", title: "Note", content: "Body", status: "published" },
      pepper,
      lookup,
      touch: async () => {
        touched = true;
      },
      create: async (article) => {
        saved = article;
        return { id: "1", slug: "note", type: article.type };
      },
    });
    expect(published.status).toBe(400);
    expect(saved).toBeNull();

    const draft = await createAgentDraft({
      authorization: `Bearer ${plaintext}`,
      payload: { type: "market_review", title: "Week of 27 Oct", content: "# Hello", excerpt: "Short" },
      pepper,
      lookup,
      touch: async () => {
        touched = true;
      },
      create: async (article) => {
        saved = article;
        return { id: "1", slug: "week-of-27-oct", type: article.type };
      },
    });
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({ status: "draft", type: "market_review", slug: "week-of-27-oct" });
    expect(saved).toMatchObject({ type: "MARKET_REVIEW", title: "Week of 27 Oct" });
    expect(touched).toBe(true);
  });
});
