import { describe, expect, it } from "vitest";
import { authorize, canReadArticle, inviteDecision, roleChangeAllowed, type Action } from "@/lib/auth/permissions";
import type { Role } from "@/lib/domain";

const ACTIONS: Action[] = [
  "view_book",
  "edit_book",
  "import_csv",
  "update_price",
  "record_snapshot",
  "write_article",
  "publish_article",
  "read_draft",
  "read_published",
  "view_audit",
  "manage_team",
  "manage_tokens",
];

describe("role permissions", () => {
  it("rejects signed-out visitors for every action", () => {
    for (const action of ACTIONS) expect(authorize(null, action)).toBe(false);
  });

  it("lets viewers read the book and published articles only", () => {
    const allowed = ACTIONS.filter((action) => authorize("VIEWER", action));
    expect(allowed.sort()).toEqual(["read_published", "view_book"]);
    expect(canReadArticle("VIEWER", "PUBLISHED")).toBe(true);
    expect(canReadArticle("VIEWER", "DRAFT")).toBe(false);
  });

  it("lets editors run the book and both article sections, not access control", () => {
    const role: Role = "EDITOR";
    expect(authorize(role, "edit_book")).toBe(true);
    expect(authorize(role, "import_csv")).toBe(true);
    expect(authorize(role, "write_article")).toBe(true);
    expect(authorize(role, "publish_article")).toBe(true);
    expect(authorize(role, "read_draft")).toBe(true);
    expect(authorize(role, "manage_team")).toBe(false);
    expect(authorize(role, "manage_tokens")).toBe(false);
  });

  it("lets admins manage invites, roles, and tokens", () => {
    expect(authorize("ADMIN", "manage_team")).toBe(true);
    expect(authorize("ADMIN", "manage_tokens")).toBe(true);
    expect(authorize("ADMIN", "edit_book")).toBe(true);
  });
});

describe("invite gate", () => {
  const directory = [
    { email: "owner@example.com", disabled: false },
    { email: "editor@example.com", disabled: false },
    { email: "former@example.com", disabled: true },
  ];

  it("rejects emails that were never invited", () => {
    expect(inviteDecision("stranger@example.com", directory)).toEqual({
      allowed: false,
      reason: "not_invited",
    });
  });

  it("rejects revoked invites and malformed addresses", () => {
    expect(inviteDecision("former@example.com", directory).allowed).toBe(false);
    expect(inviteDecision("not-an-email", directory)).toEqual({ allowed: false, reason: "invalid" });
  });

  it("allows an invited address regardless of case", () => {
    expect(inviteDecision("Editor@Example.com", directory)).toEqual({ allowed: true });
  });
});

describe("role changes", () => {
  it("refuses to remove the last admin or your own access", () => {
    expect(
      roleChangeAllowed({
        targetId: "a",
        actorId: "a",
        targetIsAdmin: true,
        nextIsAdmin: false,
        adminCount: 2,
        disabling: true,
      }),
    ).toMatch(/cannot revoke/i);
    expect(
      roleChangeAllowed({
        targetId: "a",
        actorId: "b",
        targetIsAdmin: true,
        nextIsAdmin: false,
        adminCount: 1,
        disabling: false,
      }),
    ).toMatch(/at least one admin/i);
  });

  it("allows inviting a friend straight to editor by leaving admin count intact", () => {
    expect(
      roleChangeAllowed({
        targetId: "friend",
        actorId: "owner",
        targetIsAdmin: false,
        nextIsAdmin: false,
        adminCount: 1,
        disabling: false,
      }),
    ).toBeNull();
  });
});
