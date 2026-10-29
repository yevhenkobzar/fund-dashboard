import Link from "next/link";
import { notFound } from "next/navigation";
import { dateInputValue } from "@/lib/format";
import { Flash, PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { VoidButton } from "@/components/void-button";
import { voidTransaction } from "@/server/mutations";
import { requireAction } from "@/server/guard";
import { loadBook } from "@/server/queries";

export const metadata = { title: "Edit transaction" };

export default async function EditTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAction("edit_book");
  const { id } = await params;
  const query = await searchParams;
  const book = await loadBook();
  const row = book.rows.find((item) => item.id === id);
  if (!row || row.voidedAt) notFound();
  return (
    <div>
      <Link href="/transactions" className="text-sm text-primary">Back to transactions</Link>
      <PageHeader kicker="Correct the log" title="Edit transaction" description="Saving replays the whole book. If a later trade would go short, the edit is refused and nothing changes." />
      <Flash error={query.error} success={query.saved ? "Changes saved." : undefined} />
      <TransactionForm
        instruments={book.instruments}
        ledger={book.active}
        initial={{
          id: row.id,
          occurredAt: dateInputValue(row.occurredAt),
          type: row.type,
          symbol: row.instrument?.symbol ?? "",
          name: "",
          assetClass: "",
          sleeve: "",
          quantity: row.quantity ?? "",
          price: row.price ?? "",
          amount: row.amount ?? "",
          fee: row.fee ?? "",
          notes: row.notes ?? "",
          seq: row.createdAt.getTime(),
        }}
      />
      <div className="mt-6">
        <VoidButton
          action={voidTransaction}
          id={row.id}
          title="Void this transaction?"
          body="It stays in the audit trail and drops out of the book. If a later trade depends on it, the void is refused."
        />
      </div>
    </div>
  );
}
