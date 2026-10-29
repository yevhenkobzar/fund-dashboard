import { createHash, randomBytes } from "node:crypto";

export function hashApiToken(plaintext: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${plaintext}`).digest("hex");
}

export function generateApiToken(pepper: string): { plaintext: string; hash: string; prefix: string } {
  const plaintext = `fdk_${randomBytes(32).toString("base64url")}`;
  return {
    plaintext,
    hash: hashApiToken(plaintext, pepper),
    prefix: plaintext.slice(0, 12),
  };
}

export function readBearer(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export function tokenPepper(): string {
  const pepper = process.env.AUTH_SECRET?.trim() ?? "";
  if (pepper.length < 16) {
    throw new Error("AUTH_SECRET must be set before API tokens can be used.");
  }
  return pepper;
}
