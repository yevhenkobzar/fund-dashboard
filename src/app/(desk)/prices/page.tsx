import { authorize } from "@/lib/auth/permissions";
import { priceFetcher } from "@/lib/prices/fetcher";
import { formatDateTime, formatUsd } from "@/lib/format";
import { Flash, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePrice } from "@/server/mutations";
import { requireUser } from "@/server/guard";
import { loadBook } from "@/server/queries";

export const metadata = { title: "Prices" };

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const book = await loadBook();
  const canEdit = authorize(user.role, "update_price");
  return (
    <div>
      <PageHeader
        kicker="Manual marks"
        title="Prices"
        description={priceFetcher ? `${priceFetcher.label} can suggest marks.` : "No price feed is connected. Marks are typed in here and used for AUM. A fetcher can be registered later in src/lib/prices/fetcher.ts."}
      />
      <Flash error={query.error} success={query.saved ? `Updated ${query.saved}.` : undefined} />
      {book.instruments.length === 0 ? <p className="text-sm text-muted-foreground">Add a transaction before there is anything to mark.</p> : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="book-table min-w-[640px]">
            <thead><tr><th>Symbol</th><th>Mark</th><th>Updated</th>{canEdit ? <th></th> : null}</tr></thead>
            <tbody>
              {book.instruments.map((instrument) => (
                <tr key={instrument.id}>
                  <td>
                    <div className="font-medium">{instrument.symbol}</div>
                    <div className="text-xs text-muted-foreground">{instrument.name}</div>
                  </td>
                  <td className="tabular-nums">{instrument.currentPrice ? formatUsd(instrument.currentPrice) : "Unpriced"}</td>
                  <td className="text-muted-foreground">{instrument.priceUpdatedAt ? formatDateTime(instrument.priceUpdatedAt) : "—"}</td>
                  {canEdit ? (
                    <td>
                      <form action={updatePrice} className="flex items-center gap-2">
                        <input type="hidden" name="symbol" value={instrument.symbol} />
                        <Input name="price" defaultValue={instrument.currentPrice ?? ""} inputMode="decimal" className="h-9 w-32" aria-label={`Price for ${instrument.symbol}`} />
                        <Button type="submit" size="sm">Save</Button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
