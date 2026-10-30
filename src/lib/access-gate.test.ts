import { describe, expect, it } from "vitest";
import { accountsEnabled } from "@/lib/accounts";
import { accessAttempt, codesMatch, readAccessSession, signAccessSession } from "@/lib/access-gate";

describe("accounts feature flag", () => {
  it("stays off unless explicitly enabled", () => {
    expect(accountsEnabled({ ACCOUNTS_ENABLED: undefined, NODE_ENV: "test" })).toBe(false);
    expect(accountsEnabled({ ACCOUNTS_ENABLED: "false" })).toBe(false);
    expect(accountsEnabled({ ACCOUNTS_ENABLED: "true" })).toBe(true);
  });
});

describe("access code", () => {
  it("accepts only the configured code and rejects an empty configuration", () => {
    expect(codesMatch("correct horse", "correct horse")).toBe(true);
    expect(codesMatch("wrong horse", "correct horse")).toBe(false);
    expect(codesMatch("", "")).toBe(false);
    expect(codesMatch("anything", "")).toBe(false);
  });
});

describe("access session cookie", () => {
  const secret = "test-secret-at-least-16";

  it("round-trips a signed session and rejects tampering", () => {
    const token = signAccessSession({ email: "owner@example.com", exp: Date.now() + 60_000 }, secret);
    expect(readAccessSession(token, secret)?.email).toBe("owner@example.com");
    expect(readAccessSession(token, "other-secret-at-least-16")).toBeNull();
    expect(readAccessSession(`${token}x`, secret)).toBeNull();
    expect(readAccessSession(token, secret, Date.now() + 120_000)).toBeNull();
  });
});

describe("access attempt limit", () => {
  it("allows five failures and blocks the next ones until the window passes", () => {
    const store = new Map();
    const now = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      expect(accessAttempt(store, "1.2.3.4", now, true).allowed).toBe(true);
    }
    const blocked = accessAttempt(store, "1.2.3.4", now + 1, false);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(accessAttempt(store, "1.2.3.4", now + 11 * 60 * 1000, false).allowed).toBe(true);
  });
});
