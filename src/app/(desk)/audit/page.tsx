import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { requireAction } from "@/server/guard";

export const metadata = { title: "Audit trail" };

export default async function AuditPage() {
  await requireAction("view_audit");
  const events = await prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div>
      <PageHeader kicker="Who changed what" title="Audit trail" description="Creates, edits, voids, price marks, invites, and token changes. Voided trades stay here even after they leave the book." />
      {events.length === 0 ? <p className="text-sm text-muted-foreground">No audited changes yet. The example seed does not write a trail.</p> : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-card">
          {events.map((event) => (
            <li key={event.id} className="px-4 py-3">
              <p className="text-sm">{event.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(event.createdAt)} · {event.actorEmail || "System"} · {event.action} {event.entityType}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
