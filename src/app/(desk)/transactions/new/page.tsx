import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { todayUtcDate } from "@/lib/format";
import { requireAction } from "@/server/guard";
import { loadBook } from "@/server/queries";

export const metadata = { title: "New transaction" };

export default async function NewTransactionPage() {
  await requireAction("edit_book");
  const book = await loadBook();
  return (
    <div>
      <PageHeader kicker="Manual entry" title="New transaction" description="The book updates as soon as this is saved. A sale or withdrawal that the position cannot cover is refused." />
      <TransactionForm
        instruments={book.instruments}
        ledger={book.active}
        initial={{ occurredAt: todayUtcDate(), type: "BUY", symbol: "", name: "", assetClass: "", sleeve: "", quantity: "", price: "", amount: "", fee: "", notes: "", seq: Date.now() }}
      />
    </div>
  );
}
