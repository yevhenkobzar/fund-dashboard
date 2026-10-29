import Link from "next/link";
import { notFound } from "next/navigation";
import { authorize } from "@/lib/auth/permissions";
import { ASSET_CLASSES, ASSET_LABEL, SLEEVES, SLEEVE_LABEL, TX_LABEL } from "@/lib/domain";
import { formatDate, formatQty, formatUsd, pnlClass, formatSignedUsd } from "@/lib/format";
import { Flash, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteInstrument, updateInstrument, updatePrice } from "@/server/mutations";
import { requireUser } from "@/server/guard";
import { loadBook } from "@/server/queries";

export default async function HoldingPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const { symbol: raw } = await params;
  const query = await searchParams;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const book = await loadBook();
  const instrument = book.instruments.find((item) => item.symbol === symbol);
  if (!instrument) notFound();
  const line = book.valued?.lines.find((item) => item.instrumentId === instrument.id);
  const trades = book.rows.filter((row) => row.instrumentId === instrument.id && !row.voidedAt);
  const canEdit = authorize(user.role, "edit_book");

  return (
    <div>
      <Link href="/holdings" className="text-sm text-primary">Back to holdings</Link>
      <PageHeader kicker={`${SLEEVE_LABEL[instrument.sleeve]} sleeve`} title={instrument.symbol} description={instrument.name} />
      <Flash error={query.error} success={query.saved ? "Saved." : undefined} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Mini label="Quantity" value={line ? formatQty(line.quantity) : "0"} />
        <Mini label="Avg cost" value={line?.averageCost ? formatUsd(line.averageCost) : "—"} />
        <Mini label="Price" value={line?.price ? formatUsd(line.price) : "Unpriced"} />
        <Mini label="Unrealized" value={line?.unrealizedPnl ? formatSignedUsd(line.unrealizedPnl) : "—"} className={line?.unrealizedPnl ? pnlClass(line.unrealizedPnl) : ""} />
      </div>
      {canEdit ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <form action={updatePrice} className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-serif text-2xl">Mark</h2>
            <input type="hidden" name="symbol" value={instrument.symbol} />
            <Label className="mt-3 block" htmlFor="price">Current price</Label>
            <Input id="price" name="price" defaultValue={instrument.currentPrice ?? ""} inputMode="decimal" />
            <div className="mt-3 flex gap-2">
              <Button type="submit">Save price</Button>
              <Button type="submit" name="intent" value="clear" variant="secondary">Clear mark</Button>
            </div>
          </form>
          <form action={updateInstrument} className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-serif text-2xl">Classification</h2>
            <input type="hidden" name="symbol" value={instrument.symbol} />
            <Label className="mt-3 block" htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={instrument.name} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="assetClass">Asset class</Label>
                <select id="assetClass" name="assetClass" defaultValue={instrument.assetClass} className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm">
                  {ASSET_CLASSES.map((item) => <option key={item} value={item}>{ASSET_LABEL[item]}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="sleeve">Sleeve</Label>
                <select id="sleeve" name="sleeve" defaultValue={instrument.sleeve} className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm">
                  {SLEEVES.map((item) => <option key={item} value={item}>{SLEEVE_LABEL[item]}</option>)}
                </select>
              </div>
            </div>
            <Label className="mt-3 block" htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={instrument.notes ?? ""} />
            <Button className="mt-3" type="submit">Save classification</Button>
          </form>
        </div>
      ) : null}
      <h2 className="mt-8 font-serif text-2xl">Trades</h2>
      {trades.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No active trades.</p> : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {trades.map((trade) => (
            <li key={trade.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>{formatDate(trade.occurredAt)} · {TX_LABEL[trade.type]} · {trade.quantity ? formatQty(trade.quantity) : formatUsd(trade.amount ?? "0")}</span>
              {canEdit ? <Link className="text-primary" href={`/transactions/${trade.id}/edit`}>Edit</Link> : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit && trades.length === 0 ? (
        <form action={deleteInstrument} className="mt-4">
          <input type="hidden" name="symbol" value={instrument.symbol} />
          <Button type="submit" variant="destructive">Delete unused symbol</Button>
        </form>
      ) : null}
    </div>
  );
}

function Mini({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-2xl tabular-nums ${className ?? ""}`}>{value}</p>
    </div>
  );
}
