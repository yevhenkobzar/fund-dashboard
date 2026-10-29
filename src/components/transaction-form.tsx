"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { ASSET_CLASSES, ASSET_LABEL, SLEEVES, SLEEVE_LABEL, TX_LABEL, TX_TYPES, type TxType } from "@/lib/domain";
import { formatQty, formatSignedUsd, formatUsd } from "@/lib/format";
import { deriveBook, type LedgerTx } from "@/lib/ledger/derive";
import { normalizeDraft, type InstrumentRef } from "@/lib/ledger/validate";
import type { ActionState } from "@/server/mutations";
import { saveTransaction } from "@/server/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Initial = {
  id?: string;
  occurredAt: string;
  type: TxType;
  symbol: string;
  name: string;
  assetClass: string;
  sleeve: string;
  quantity: string;
  price: string;
  amount: string;
  fee: string;
  notes: string;
  seq: number;
};

const HELP: Record<TxType, { cash: string; asset: string }> = {
  BUY: { cash: "", asset: "Quantity increases. Cost basis increases by quantity times price, plus the fee." },
  SELL: { cash: "", asset: "Quantity decreases at average cost. The fee reduces proceeds." },
  DEPOSIT: {
    cash: "Cash coming into the fund, such as a capital call.",
    asset: "In-kind contribution. Price is the cost basis per unit. Use 0 if the units have no cost.",
  },
  WITHDRAWAL: {
    cash: "Cash leaving the fund, such as a distribution.",
    asset: "In-kind distribution. Cost basis is relieved at the average cost.",
  },
  FEE: {
    cash: "A cash expense. It reduces cash and does not change a position.",
    asset: "An in-kind fee. Quantity leaves the position at average cost.",
  },
  YIELD: {
    cash: "Income received in cash.",
    asset: "Units received. Leave price empty to carry them at zero cost, or enter a cost per unit.",
  },
};

export function TransactionForm({
  instruments,
  ledger,
  initial,
}: {
  instruments: InstrumentRef[];
  ledger: LedgerTx[];
  initial: Initial;
}) {
  const [state, action, pending] = useActionState(saveTransaction, {} as ActionState);
  const [type, setType] = useState<TxType>(initial.type);
  const [mode, setMode] = useState<"cash" | "asset">(initial.type === "BUY" || initial.type === "SELL" || initial.symbol ? "asset" : "cash");
  const [symbol, setSymbol] = useState(initial.symbol);
  const [name, setName] = useState(initial.name);
  const [assetClass, setAssetClass] = useState(initial.assetClass);
  const [sleeve, setSleeve] = useState(initial.sleeve);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [price, setPrice] = useState(initial.price);
  const [amount, setAmount] = useState(initial.amount);
  const [fee, setFee] = useState(initial.fee);
  const [occurredAt, setOccurredAt] = useState(initial.occurredAt);
  const [notes, setNotes] = useState(initial.notes);
  const [dirty, setDirty] = useState(false);
  const mark = () => setDirty(true);
  const assetMode = type === "BUY" || type === "SELL" || mode === "asset";
  const existing = instruments.find((item) => item.symbol === symbol.trim().toUpperCase());

  const preview = useMemo(() => {
    const normalized = normalizeDraft(
      {
        id: initial.id,
        occurredAt,
        type,
        symbol: assetMode ? symbol : "",
        name,
        assetClass,
        sleeve,
        quantity: assetMode ? quantity : "",
        price: assetMode ? price : "",
        amount: assetMode ? "" : amount,
        fee: type === "BUY" || type === "SELL" ? fee : "",
        notes,
      },
      instruments,
      initial.seq,
    );
    if (!normalized.ok) return { ok: false as const, errors: normalized.fieldErrors };
    const others = ledger.filter((tx) => tx.id !== initial.id);
    const before = deriveBook(others);
    const after = deriveBook([...others, { ...normalized.value.tx, seq: initial.seq }]);
    return { ok: true as const, before, after, symbol: normalized.value.symbol, create: normalized.value.createInstrument };
  }, [amount, assetClass, assetMode, fee, initial.id, initial.seq, instruments, ledger, name, notes, occurredAt, price, quantity, sleeve, symbol, type]);

  const liveErrors = dirty && !preview.ok ? preview.errors : {};
  const merged = { ...liveErrors, ...state.fieldErrors };

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="type" value={type} />
      <div className="space-y-5 rounded-lg border border-border bg-card p-4 md:p-5">
        <div>
          <Label>Type</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {TX_TYPES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setType(item);
                  if (item === "BUY" || item === "SELL") setMode("asset");
                  mark();
                }}
                className={`rounded-full px-3 py-1 text-sm ${type === item ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                {TX_LABEL[item]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="occurredAt">Date</Label>
            <Input
              id="occurredAt"
              name="occurredAt"
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              autoComplete="off"
              value={occurredAt}
              onChange={(event) => {
                setOccurredAt(event.target.value);
                mark();
              }}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">YYYY-MM-DD</p>
            {merged.occurredAt ? <p className="mt-1 text-xs text-danger">{merged.occurredAt}</p> : null}
          </div>
          {type !== "BUY" && type !== "SELL" ? (
            <div>
              <Label>Movement</Label>
              <div className="mt-2 flex gap-2">
                {(["cash", "asset"] as const).map((item) => (
                  <button key={item} type="button" onClick={() => { setMode(item); mark(); }} className={`rounded-full px-3 py-1 text-sm ${mode === item ? "bg-ink text-white" : "bg-secondary"}`}>
                    {item === "cash" ? "Cash" : "Asset"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{HELP[type][assetMode ? "asset" : "cash"]}</p>
        {assetMode ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="symbol">Symbol</Label>
              <Input id="symbol" name="symbol" list="symbols" value={symbol} onChange={(event) => { setSymbol(event.target.value.toUpperCase()); mark(); }} placeholder="BTC" />
              <datalist id="symbols">
                {instruments.map((item) => <option key={item.id} value={item.symbol}>{item.name}</option>)}
              </datalist>
              {merged.symbol ? <p className="mt-1 text-xs text-danger">{merged.symbol}</p> : null}
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" inputMode="decimal" value={quantity} onChange={(event) => { setQuantity(event.target.value); mark(); }} />
              {merged.quantity ? <p className="mt-1 text-xs text-danger">{merged.quantity}</p> : null}
            </div>
            <div>
              <Label htmlFor="price">{type === "DEPOSIT" ? "Cost / unit" : type === "YIELD" ? "Cost / unit (optional)" : "Price"}</Label>
              <Input id="price" name="price" inputMode="decimal" value={price} onChange={(event) => { setPrice(event.target.value); mark(); }} />
              {merged.price ? <p className="mt-1 text-xs text-danger">{merged.price}</p> : null}
            </div>
            {type === "BUY" || type === "SELL" ? (
              <div>
                <Label htmlFor="fee">Cash fee</Label>
                <Input id="fee" name="fee" inputMode="decimal" value={fee} onChange={(event) => { setFee(event.target.value); mark(); }} placeholder="0" />
                {merged.fee ? <p className="mt-1 text-xs text-danger">{merged.fee}</p> : null}
              </div>
            ) : <input type="hidden" name="fee" value="" />}
            {existing ? (
              <p className="sm:col-span-2 text-sm text-muted-foreground">{existing.name} · {ASSET_LABEL[existing.assetClass]} · {SLEEVE_LABEL[existing.sleeve]} sleeve</p>
            ) : (
              <>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" value={name} onChange={(event) => { setName(event.target.value); mark(); }} />
                  {merged.name ? <p className="mt-1 text-xs text-danger">{merged.name}</p> : null}
                </div>
                <div>
                  <Label htmlFor="assetClass">Asset class</Label>
                  <select id="assetClass" name="assetClass" value={assetClass} onChange={(event) => { setAssetClass(event.target.value); mark(); }} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm">
                    <option value="">Choose</option>
                    {ASSET_CLASSES.map((item) => <option key={item} value={item}>{ASSET_LABEL[item]}</option>)}
                  </select>
                  {merged.assetClass ? <p className="mt-1 text-xs text-danger">{merged.assetClass}</p> : null}
                </div>
                <div>
                  <Label htmlFor="sleeve">Sleeve</Label>
                  <select id="sleeve" name="sleeve" value={sleeve} onChange={(event) => { setSleeve(event.target.value); mark(); }} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm">
                    <option value="">Choose</option>
                    {SLEEVES.map((item) => <option key={item} value={item}>{SLEEVE_LABEL[item]}</option>)}
                  </select>
                  {merged.sleeve ? <p className="mt-1 text-xs text-danger">{merged.sleeve}</p> : null}
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            <input type="hidden" name="symbol" value="" />
            <input type="hidden" name="quantity" value="" />
            <input type="hidden" name="price" value="" />
            <input type="hidden" name="fee" value="" />
            <Label htmlFor="amount">Cash amount</Label>
            <Input id="amount" name="amount" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); mark(); }} />
            {merged.amount ? <p className="mt-1 text-xs text-danger">{merged.amount}</p> : null}
          </div>
        )}
        {!assetMode ? null : <input type="hidden" name="amount" value="" />}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" value={notes} onChange={(event) => { setNotes(event.target.value); mark(); }} />
          {merged.notes ? <p className="mt-1 text-xs text-danger">{merged.notes}</p> : null}
        </div>
        {state.formError ? <p className="text-sm text-danger">{state.formError}</p> : null}
        <Button type="submit" disabled={pending || (preview.ok && !preview.after.ok)}>
          {pending ? "Saving…" : initial.id ? "Save changes" : "Add to the book"}
        </Button>
      </div>
      <aside className="h-fit rounded-lg border border-border bg-[#f7f3ea] p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Impact</p>
        <h2 className="mt-1 font-serif text-2xl">Before you save</h2>
        {!dirty && !state.formError ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Cash and average cost update here as you fill in the trade. Cost basis uses average cost.</p>
        ) : null}
        {dirty && !preview.ok ? (
          <ul className="mt-3 space-y-1 text-sm text-danger">
            {Object.values(preview.errors).map((error) => <li key={error}>{error}</li>)}
          </ul>
        ) : null}
        {preview.ok && !preview.after.ok ? <p className="mt-3 text-sm text-danger">{preview.after.error}</p> : null}
        {preview.ok && preview.before.ok && preview.after.ok ? (
          <div className="mt-4 space-y-3 text-sm">
            {preview.create ? <p>New symbol {preview.create.symbol} will be added to the {SLEEVE_LABEL[preview.create.sleeve]} sleeve.</p> : null}
            <p className="flex justify-between gap-3"><span>Cash</span><span className="tabular-nums">{formatUsd(preview.before.book.cash)} → {formatUsd(preview.after.book.cash)}</span></p>
            <p className="flex justify-between gap-3"><span>Cash change</span><span className="tabular-nums">{formatSignedUsd(String(Number(preview.after.book.cash) - Number(preview.before.book.cash)))}</span></p>
            {preview.symbol ? (
              <PositionDelta before={preview.before.book.positions.find((item) => item.symbol === preview.symbol)} after={preview.after.book.positions.find((item) => item.symbol === preview.symbol)} symbol={preview.symbol} />
            ) : null}
          </div>
        ) : null}
      </aside>
    </form>
  );
}

function PositionDelta({
  before,
  after,
  symbol,
}: {
  before?: { quantity: string; averageCost: string | null };
  after?: { quantity: string; averageCost: string | null };
  symbol: string;
}) {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="font-medium">{symbol}</p>
      <p className="flex justify-between gap-3"><span>Quantity</span><span className="tabular-nums">{formatQty(before?.quantity ?? "0")} → {formatQty(after?.quantity ?? "0")}</span></p>
      <p className="flex justify-between gap-3"><span>Avg cost</span><span className="tabular-nums">{before?.averageCost ? formatUsd(before.averageCost) : "—"} → {after?.averageCost ? formatUsd(after.averageCost) : "—"}</span></p>
    </div>
  );
}
