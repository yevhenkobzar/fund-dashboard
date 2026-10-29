import Link from "next/link";
import { holdingSources, syncAdapters } from "@/lib/sources/registry";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/page-header";
import { requireUser } from "@/server/guard";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireUser();
  const active = holdingSources.filter((source) => source.availability === "active");
  const later = holdingSources.filter((source) => source.availability === "coming_soon");
  return (
    <div>
      <PageHeader
        kicker="Data sources"
        title="Integrations"
        description="Version 1 is a manual book. Venue sync is a placeholder so a read-only adapter can be added later without changing how positions are derived."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {active.map((source) => (
          <Panel key={source.id} title={source.name}>
            <Badge>Active</Badge>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{source.summary}</p>
            <Link href={source.id === "csv" ? "/import" : "/transactions"} className="mt-3 inline-block text-sm text-primary">Open</Link>
          </Panel>
        ))}
      </div>
      <section className="mt-8 rounded-lg border border-dashed border-border bg-card/60 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-2xl">Integrations (coming soon)</h2>
          <Badge>Disabled</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          No sync adapter is registered ({Object.keys(syncAdapters).length} connected). These venues are not called, and this version asks for none of their credentials.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {later.map((source) => (
            <div key={source.id} className="rounded-md border border-border bg-paper p-4 opacity-70">
              <p className="font-medium">{source.name}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{source.summary}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Coming soon</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
