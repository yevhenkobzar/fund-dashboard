import { fundName } from "@/lib/fund";
import { requestMagicLink } from "@/server/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<string, string> = {
  uninvited: "That email is not on the invite list. An admin has to add it before it can sign in.",
  revoked: "Access for this email has been revoked.",
  invalid: "Enter a valid email address.",
  send: "The sign-in link could not be sent. Check the email settings and try again.",
  AccessDenied: "Sign-in was refused for this email.",
  Verification: "This sign-in link is invalid or has expired. Request a new one.",
  Configuration: "Email sign-in is not configured.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const dev = process.env.NODE_ENV !== "production" && (process.env.EMAIL_PROVIDER ?? "console") === "console";
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="text-[11px] uppercase tracking-[0.18em] text-brass">Invite only</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">{fundName()}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A private desk for the partnership. There is no public sign-up. Enter the email an admin invited and we will send a sign-in link.
        </p>
        <form action={requestMagicLink} className="mt-8 space-y-4 rounded-lg border border-border bg-card p-5">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@firm.com" />
          </div>
          {error ? <p className="text-sm text-danger">{ERRORS[error] ?? "Sign-in could not be completed."}</p> : null}
          <Button type="submit" className="w-full">Email me a sign-in link</Button>
        </form>
        {dev ? (
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Local development prints the link on the next screen and in the server log. That convenience is off in production.
          </p>
        ) : null}
      </div>
    </main>
  );
}
