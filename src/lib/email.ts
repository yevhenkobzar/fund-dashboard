import nodemailer from "nodemailer";
import { fundName } from "@/lib/fund";

type DevLink = { email: string; url: string; at: number };
const globalForDev = globalThis as unknown as { __devMagicLink?: DevLink };

function message(url: string) {
  const name = fundName();
  const text = [
    `Sign in to ${name}.`,
    "",
    url,
    "",
    "This link expires in 24 hours and only works for an invited email.",
    "If you did not ask for it, you can ignore this message.",
  ].join("\n");
  const html = `<p>Sign in to ${escapeHtml(name)}.</p><p><a href="${url}">Open the desk</a></p><p>This link expires in 24 hours and only works for an invited email. If you did not ask for it, you can ignore this message.</p>`;
  return { text, html, subject: `Sign in to ${name}` };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendMagicLink({ to, url }: { to: string; url: string }) {
  const provider = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();
  const from = process.env.EMAIL_FROM || "desk@example.com";
  const body = message(url);

  if (provider === "resend") {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set.");
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from, to, subject: body.subject, text: body.text, html: body.html });
    if (result.error) throw new Error(result.error.message);
    return;
  }

  if (provider === "smtp") {
    if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST is not set.");
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
    await transport.sendMail({ from, to, subject: body.subject, text: body.text, html: body.html });
    return;
  }

  console.info(`\n[fund-desk] Magic link for ${to}\n${url}\n`);
  if (process.env.NODE_ENV !== "production") {
    globalForDev.__devMagicLink = { email: to.toLowerCase(), url, at: Date.now() };
  }
}

export function readDevMagicLink(email: string): string | null {
  if (process.env.NODE_ENV === "production") return null;
  if ((process.env.EMAIL_PROVIDER ?? "console").toLowerCase() !== "console") return null;
  const link = globalForDev.__devMagicLink;
  if (!link) return null;
  if (link.email !== email.toLowerCase()) return null;
  if (Date.now() - link.at > 15 * 60 * 1000) return null;
  return link.url;
}
