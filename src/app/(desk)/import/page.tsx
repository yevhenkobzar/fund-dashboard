import { CSV_COLUMNS } from "@/lib/csv/transactions";
import { ImportForm } from "@/components/import-form";
import { PageHeader } from "@/components/page-header";
import { requireAction } from "@/server/guard";

export const metadata = { title: "CSV import" };

const DOCS: Record<(typeof CSV_COLUMNS)[number], string> = {
  occurred_at: "YYYY-MM-DD",
  type: "buy, sell, deposit, withdrawal, fee, or yield",
  symbol: "Required for buys and sells. Blank for cash movements.",
  name: "Required only when the symbol is new",
  asset_class: "crypto, stock, thematic_basket, or defi_yield",
  sleeve: "crypto, stocks, thematic, defi_yield, or arbitrage",
  quantity: "Asset units. Positive.",
  price: "Per unit. Required on buys, sells, and in-kind deposits.",
  amount: "Cash amount when there is no symbol.",
  fee: "Optional cash fee. On buys it is added to cost. On sells it reduces proceeds.",
  notes: "Optional",
  external_ref: "Optional idempotency key. Repeat imports skip rows already stored.",
};

export default async function ImportPage() {
  await requireAction("import_csv");
  return (
    <div>
      <PageHeader
        kicker="Convenience"
        title="CSV import"
        description="Same transaction types as the form. Invalid rows block the whole file. Rows with an external ref that is already in the book are skipped."
      />
      <p className="mb-4 text-sm">
        <a className="text-primary underline" href="/templates/transactions.csv">Download the sample template</a>
      </p>
      <ImportForm />
      <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="book-table">
          <thead><tr><th>Column</th><th>Meaning</th></tr></thead>
          <tbody>
            {CSV_COLUMNS.map((column) => (
              <tr key={column}><td className="font-mono text-xs">{column}</td><td>{DOCS[column]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
