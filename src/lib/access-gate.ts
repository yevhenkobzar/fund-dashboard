import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "desk_access";
export const ACCESS_MAX_ATTEMPTS = 5;
export const ACCESS_WINDOW_MS = 10 * 60 * 1000;
export const ACCESS_SESSION_MS = 14 * 24 * 60 * 60 * 1000;

export type AccessSession = {
  email: string;
  exp: number;
};

type Bucket = { failures: number; resetAt: number };

/**
 * Compare the submitted code with SITE_ACCESS_CODE.
 * Both values are hashed first so timingSafeEqual always runs on equal-length digests.
 */
export function codesMatch(provided: string, expected: string): boolean {
  const left = createHash("sha256").update(`code:${provided}`, "utf8").digest();
  const right = createHash("sha256").update(`code:${expected}`, "utf8").digest();
  const same = timingSafeEqual(left, right);
  return expected.length > 0 && same;
}

export function signAccessSession(session: AccessSession, secret: string): string {
  const body = Buffer.from(JSON.stringify({ email: session.email, exp: session.exp }), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function readAccessSession(token: string, secret: string, now = Date.now()): AccessSession | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || !secret) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const given = Buffer.from(mac);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<AccessSession>;
    if (typeof parsed.email !== "string" || typeof parsed.exp !== "number") return null;
    if (!Number.isFinite(parsed.exp) || parsed.exp <= now) return null;
    return { email: parsed.email, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function accessAttempt(
  store: Map<string, Bucket>,
  key: string,
  now: number,
  failed: boolean,
  opts: { windowMs?: number; max?: number } = {},
): { allowed: boolean; retryAfterSec: number } {
  const windowMs = opts.windowMs ?? ACCESS_WINDOW_MS;
  const max = opts.max ?? ACCESS_MAX_ATTEMPTS;
  const current = store.get(key);
  const fresh = !current || current.resetAt <= now;
  const bucket = fresh ? { failures: 0, resetAt: now + windowMs } : current;
  if (bucket.failures >= max) {
    store.set(key, bucket);
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  if (failed) bucket.failures += 1;
  store.set(key, bucket);
  return { allowed: true, retryAfterSec: 0 };
}

const globalAttempts = globalThis as { __deskAccessAttempts?: Map<string, Bucket> };

export function accessAttemptStore() {
  globalAttempts.__deskAccessAttempts ??= new Map();
  return globalAttempts.__deskAccessAttempts;
}
