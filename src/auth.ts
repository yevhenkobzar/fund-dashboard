import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import type { Role } from "@prisma/client";
import { sendMagicLink } from "@/lib/email";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  providers: [
    Nodemailer({
      server: { host: "127.0.0.1", port: 1025, auth: { user: "unused", pass: "unused" } },
      from: process.env.EMAIL_FROM || "desk@example.com",
      maxAge: 24 * 60 * 60,
      sendVerificationRequest: async ({ identifier, url }) => {
        await sendMagicLink({ to: identifier, url });
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase().trim();
      if (!email) return false;
      const existing = await prisma.user.findUnique({ where: { email } });
      return Boolean(existing && !existing.disabledAt);
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.email = user.email ?? session.user.email;
      session.user.role = ((user as { role?: Role }).role ?? "VIEWER") as Role;
      return session;
    },
  },
});
