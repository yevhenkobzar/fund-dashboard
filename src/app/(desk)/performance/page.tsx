import { authorize } from "@/lib/auth/permissions";
import { formatDate, formatUsd } from "@/lib/format";
import { PerformanceChart } from "@/components/charts";
import { Flash, PageHeader, Panel } from "@/components/page-header";
import { SnapshotForm } from "@/components/snapshot-form";
import { VoidButton } from "@/components/void-button";
import { voidSnapshot } from "@/server/mutations";
import { requireUser } from "@/server/guard";
import { loadBook } from "@/server/queries";

export const metadata = { title: "Performance" };

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; voided?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const book = await loadBook();
  const canEdit = authorize(user.role, "record_snapshot");
  const points = book.snapshots.map((snapshot) => ({
    date: formatDate(snapshot.asOf),
    aum: Number(snapshot.aum),
    nav: snapshot.navPerShare ? Number(snapshot.navPerShare) : null,
  }));
  return (
    <div>
      <PageHeader
        kicker="Recorded by hand"
        title="Performance"
        description="The chart is the snapshot log, not a live feed. Enter AUM yourself, or fill it from the current book and adjust it."
      />
      <Flash
        error={query.error}
        success={query.saved ? "Snapshot recorded." : query.voided ? "Snapshot voided." : undefined}
      />
      <Panel>
        <PerformanceChart points={points} />
      </Panel>
      {canEdit ? (
        <Panel title="New snapshot" className="mt-4">
          <SnapshotForm currentAum={book.valued?.aum ?? "0"} />
        </Panel>
      ) : null}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="book-table">
          <thead><tr><th>Date</th><th className="text-right">AUM</th><th className="text-right">Shares</th><th className="text-right">NAV</th><th>Note</th>{canEdit ? <th></th> : null}</tr></thead>
          <tbody>
            {[...book.snapshots].reverse().map((snapshot) => (
              <tr key={snapshot.id}>
                <td>{formatDate(snapshot.asOf)}</td>
                <td className="text-right tabular-nums">{formatUsd(snapshot.aum)}</td>
                <td className="text-right tabular-nums">{snapshot.sharesOutstanding ?? "—"}</td>
                <td className="text-right tabular-nums">{snapshot.navPerShare ? formatUsd(snapshot.navPerShare) : "—"}</td>
                <td className="text-muted-foreground">{snapshot.note}</td>
                {canEdit ? (
                  <td>
                    <VoidButton action={voidSnapshot} id={snapshot.id} title="Void this snapshot?" body="It leaves the chart. You can record the date again afterwards." />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {book.snapshots.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No snapshots yet.</p> : null}
      </div>
    </div>
  );
}
