import Link from "next/link";
import { ASSET_LABEL, SLEEVES, SLEEVE_LABEL, type Sleeve } from "@/lib/domain";
import { formatPct, formatQty, formatUsd, pnlClass, formatSignedUsd } from "@/lib/format";
import { ExampleBanner, Flash, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/server/guard";
import { loadBook } from "@/server/queries";

export const metadata = { title: "Holdings" };

export default async function HoldingsPage({
  searchParams,
}: {
  searchParams: Promise<{ sleeve?: string; closed?: string; deleted?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const book = await loadBook();
  const sleeve = SLEEVES.includes(params.sleeve as Sleeve) ? (params.sleeve as Sleeve) : null;
  const lines = (book.valued?.lines ?? []).flatMap((line) => {
    const instrument = book.instruments.find((item) => item.id === line.instrumentId);
    if (!instrument) return [];
    if (sleeve && instrument.sleeve !== sleeve) return [];
    return [{ ...line, instrument }];
  });
  const aum = book.valued?.aum ?? "0";
  const openIds = new Set((book.valued?.lines ?? []).map((line) => line.instrumentId));
  const closed = book.instruments.filter((instrument) => !openIds.has(instrument.id) && book.rows.some((row) => row.instrumentId === instrument.id && !row.voidedAt));

  return (
    <div>
      <ExampleBanner show={book.hasExample} />
      <PageHeader
        kicker="Derived from the log"
        title="Holdings"
        description="Quantity and cost basis come from the transaction log. Change a position by adding, editing, or voiding a trade. Prices are manual marks."
      />
      <Flash success={params.deleted ? "Unused symbol deleted." : undefined} />
      {!book.derived.ok ? <p className="mb-4 text-sm text-danger">{book.derived.error}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/holdings" className={`rounded-full px-3 py-1 text-xs ${!sleeve ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>All</Link>
        {SLEEVES.map((item) => (
          <Link key={item} href={`/holdings?sleeve=${item}`} className={`rounded-full px-3 py-1 text-xs ${sleeve === item ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{SLEEVE_LABEL[item]}</Link>
        ))}
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open positions{sleeve ? " in this sleeve" : ""}. Add a trade or import the CSV template.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="book-table min-w-[860px]">
            <thead>
              <tr>
                <th>Symbol</th><th>Sleeve</th><th>Class</th><th className="text-right">Quantity</th><th className="text-right">Avg cost</th><th className="text-right">Price</th><th className="text-right">Value</th><th className="text-right">Unrealized</th><th className="text-right">Weight</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.instrumentId}>
                  <td>
                    <Link href={`/holdings/${line.instrument.symbol}`} className="font-medium hover:underline">{line.symbol}</Link>
                    <div className="text-xs text-muted-foreground">{line.instrument.name} {line.instrument.isExample ? <Badge className="ml-1">Example</Badge> : null}</div>
                  </td>
                  <td>{SLEEVE_LABEL[line.instrument.sleeve]}</td>
                  <td>{ASSET_LABEL[line.instrument.assetClass]}</td>
                  <td className="text-right tabular-nums">{formatQty(line.quantity)}</td>
                  <td className="text-right tabular-nums">{line.averageCost ? formatUsd(line.averageCost) : "—"}</td>
                  <td className="text-right tabular-nums">{line.price ? formatUsd(line.price) : "Unpriced"}</td>
                  <td className="text-right tabular-nums">{line.marketValue ? formatUsd(line.marketValue) : "—"}</td>
                  <td className={`text-right tabular-nums ${line.unrealizedPnl ? pnlClass(line.unrealizedPnl) : ""}`}>{line.unrealizedPnl ? formatSignedUsd(line.unrealizedPnl) : "—"}</td>
                  <td className="text-right tabular-nums">{line.marketValue ? formatPct(line.marketValue, aum) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {params.closed === "1" && closed.length > 0 ? (
        <div className="mt-6">
          <h2 className="font-serif text-2xl">Closed</h2>
          <ul className="mt-2 text-sm">
            {closed.map((instrument) => <li key={instrument.id}><Link className="text-primary" href={`/holdings/${instrument.symbol}`}>{instrument.symbol}</Link> · {instrument.name}</li>)}
          </ul>
        </div>
      ) : closed.length > 0 ? (
        <Link href={sleeve ? `/holdings?sleeve=${sleeve}&closed=1` : "/holdings?closed=1"} className="mt-4 inline-block text-sm text-primary">Show {closed.length} closed {closed.length === 1 ? "name" : "names"}</Link>
      ) : null}
    </div>
  );
}
