import { readDevMagicLink } from "@/lib/email";
import { fundName } from "@/lib/fund";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const link = email ? readDevMagicLink(email) : null;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <p className="text-[11px] uppercase tracking-[0.18em] text-brass">{fundName()}</p>
        <h1 className="mt-2 font-serif text-4xl">Check your email</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          If {email || "that address"} is invited, a sign-in link is on its way. It expires in 24 hours.
        </p>
        {link ? (
          <div className="mt-6 rounded-md border border-brass/40 bg-[#f8f1e3] p-4 text-sm">
            <p className="font-medium">Development link</p>
            <p className="mt-1 text-muted-foreground">This is shown only while the console email provider is in use.</p>
            <a href={link} className="mt-3 block break-all text-primary underline">Open the sign-in link</a>
          </div>
        ) : null}
        <a href="/login" className="mt-6 inline-block text-sm text-primary">Use a different email</a>
      </div>
    </main>
  );
}
