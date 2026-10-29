import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { signOut } from "@/auth";
import { auth } from "@/auth";
import { authorize, type Action } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export async function requireUser() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.disabledAt) {
    await signOut({ redirectTo: "/login?error=revoked" });
    redirect("/login?error=revoked");
  }
  return user;
}

export async function requireAction(action: Action) {
  const user = await requireUser();
  if (!authorize(user.role as Role, action)) redirect("/forbidden");
  return user;
}
