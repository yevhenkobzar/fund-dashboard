"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { accountsEnabled } from "@/lib/accounts";
import {
  ACCESS_COOKIE,
  ACCESS_SESSION_MS,
  accessAttempt,
  accessAttemptStore,
  codesMatch,
  readAccessSession,
  signAccessSession,
  type AccessSession,
} from "@/lib/access-gate";
import { prisma } from "@/lib/db";

function clientKey() {
  return headers().then((incoming) => {
    const forwarded = incoming.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || incoming.get("x-real-ip") || "local";
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(ACCESS_SESSION_MS / 1000),
  };
}

export async function readAccessCookie(): Promise<AccessSession | null> {
  if (accountsEnabled()) return null;
  const secret = process.env.AUTH_SECRET ?? "";
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token || secret.length < 16) return null;
  return readAccessSession(token, secret);
}

export async function unlockWithCode(formData: FormData) {
  if (accountsEnabled()) redirect("/login");
  const key = await clientKey();
  const now = Date.now();
  const gate = accessAttempt(accessAttemptStore(), key, now, false);
  if (!gate.allowed) redirect("/login?error=limited");

  const provided = String(formData.get("code") ?? "");
  const expected = process.env.SITE_ACCESS_CODE ?? "";
  if (!codesMatch(provided, expected)) {
    const failed = accessAttempt(accessAttemptStore(), key, now, true);
    redirect(failed.allowed ? "/login?error=code" : "/login?error=limited");
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const secret = process.env.AUTH_SECRET ?? "";
  if (!email || secret.length < 16) redirect("/login?error=unconfigured");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.disabledAt || user.role !== "ADMIN") redirect("/login?error=unconfigured");

  const token = signAccessSession({ email: user.email, exp: now + ACCESS_SESSION_MS }, secret);
  (await cookies()).set(ACCESS_COOKIE, token, cookieOptions());
  redirect("/");
}

export async function lockSite() {
  (await cookies()).delete(ACCESS_COOKIE);
  redirect("/login");
}
