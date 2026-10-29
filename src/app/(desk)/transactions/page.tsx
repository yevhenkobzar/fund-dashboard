import Link from "next/link";
import { authorize } from "@/lib/auth/permissions";
import { TX_LABEL, TX_TYPES, type TxType } from "@/lib/domain";
import { cashImpact } from "@/lib/ledger/derive";
import { formatDate, formatQty, formatSignedUsd, formatUsd } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Flash, PageHeader } from "@/components/page-header";
import { requireUser } from "@/server/guard";
import { loadBook, toLedger } from "@/server/queries";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; saved?: string; voided?: string; imported?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const book = await loadBook();
  const canEdit = authorize(user.role, "edit_book");
  const type = TX_TYPES.includes(params.type as TxType) ? (params.type as TxType) : null;
  const q = params.q?.trim().toLowerCase() ?? "";
  const rows = book.rows
    .filter((row) => !row.voidedAt)
    .filter((row) => (type ? row.type === type : true))
    .filter((row) => {
      if (!q) return true;
      return `${row.instrument?.symbol ?? ""} ${row.notes ?? ""}`.toLowerCase().includes(q);
    })
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
  const success = params.imported
    ? `Imported ${params.imported} transactions.`
    : params.voided
      ? "Transaction voided. The book was recalculated."
      : params.saved
        ? "Transaction saved."
        : undefined;

  return (
    <div>
      <PageHeader
        kicker="Source of the book"
        title="Transactions"
        description="Buys, sells, deposits, withdrawals, fees, and yield. Positions and average cost are derived from this log, using average cost."
        action={canEdit ? <Button asChild><Link href="/transactions/new">New transaction</Link></Button> : null}
      />
      <Flash success={success} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={params.q ?? ""} placeholder="Symbol or note" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
        <select name="type" defaultValue={type ?? ""} className="h-10 rounded-md border border-input bg-card px-3 text-sm">
          <option value="">All types</option>
          {TX_TYPES.map((item) => <option key={item} value={item}>{TX_LABEL[item]}</option>)}
        </select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions match. Add one by hand or import the CSV template.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="book-table min-w-[760px]">
            <thead>
              <tr><th>Date</th><th>Type</th><th>Symbol</th><th className="text-right">Quantity</th><th className="text-right">Price</th><th className="text-right">Cash</th><th>Note</th>{canEdit ? <th></th> : null}</tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const impact = cashImpact(toLedger(row));
                return (
                  <tr key={row.id}>
                    <td>{formatDate(row.occurredAt)}</td>
                    <td>{TX_LABEL[row.type]}</td>
                    <td>{row.instrument ? <Link className="hover:underline" href={`/holdings/${row.instrument.symbol}`}>{row.instrument.symbol}</Link> : "Cash"}</td>
                    <td className="text-right tabular-nums">{row.quantity ? formatQty(row.quantity) : "—"}</td>
                    <td className="text-right tabular-nums">{row.price ? formatUsd(row.price) : row.amount ? formatUsd(row.amount) : "—"}</td>
                    <td className="text-right tabular-nums">{formatSignedUsd(impact)}</td>
                    <td className="max-w-xs truncate text-muted-foreground">{row.notes}</td>
                    {canEdit ? <td><Link className="text-primary" href={`/transactions/${row.id}/edit`}>Edit</Link></td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
