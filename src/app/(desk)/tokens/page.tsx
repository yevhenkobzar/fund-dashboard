import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { Flash, PageHeader } from "@/components/page-header";
import { TokenForm } from "@/components/token-form";
import { revokeToken } from "@/server/mutations";
import { requireAction } from "@/server/guard";

export const metadata = { title: "API tokens" };

export default async function TokensPage({ searchParams }: { searchParams: Promise<{ error?: string; revoked?: string }> }) {
  await requireAction("manage_tokens");
  const query = await searchParams;
  const tokens = await prisma.apiToken.findMany({ orderBy: { createdAt: "desc" }, include: { creator: { select: { email: true } } } });
  return (
    <div>
      <PageHeader
        kicker="Admin"
        title="API tokens"
        description="A token lets an agent create drafts in either article section. It cannot publish, and the secret is stored only as a hash."
      />
      <Flash error={query.error} success={query.revoked ? "Token revoked." : undefined} />
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <TokenForm />
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="book-table">
            <thead><tr><th>Name</th><th>Prefix</th><th>Last used</th><th></th></tr></thead>
            <tbody>
              {tokens.length === 0 ? (
                <tr><td colSpan={4} className="text-muted-foreground">No tokens yet.</td></tr>
              ) : tokens.map((token) => (
                <tr key={token.id}>
                  <td>
                    <div className="font-medium">{token.name}</div>
                    <div className="text-xs text-muted-foreground">{token.creator.email}</div>
                  </td>
                  <td className="font-mono text-xs">{token.tokenPrefix}…</td>
                  <td>{token.revokedAt ? "Revoked" : token.lastUsedAt ? formatDateTime(token.lastUsedAt) : "Never"}</td>
                  <td>
                    {!token.revokedAt ? (
                      <form action={revokeToken}>
                        <input type="hidden" name="id" value={token.id} />
                        <button type="submit" className="text-sm text-danger">Revoke</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <pre className="mt-6 overflow-x-auto rounded-lg bg-ink p-4 text-xs leading-6 text-[#f3efe6]">{`POST /api/v1/articles
Authorization: Bearer fdk_...
Content-Type: application/json

{
  "type": "market_review",
  "title": "Week of 27 Oct",
  "content": "# Note\\n\\nMarkdown body."
}`}</pre>
    </div>
  );
}
