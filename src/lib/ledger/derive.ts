import Decimal from "decimal.js";
import type { TxType } from "@/lib/domain";
import { d, toStorage } from "@/lib/money";

export type LedgerTx = {
  id: string;
  occurredAt: string;
  seq: number;
  type: TxType;
  instrumentId: string | null;
  symbol: string | null;
  quantity: string | null;
  price: string | null;
  amount: string | null;
  fee: string | null;
  voided: boolean;
};

export type Position = {
  instrumentId: string;
  symbol: string;
  quantity: string;
  costBasis: string;
  averageCost: string | null;
};

export type Book = {
  cash: string;
  realizedPnl: string;
  positions: Position[];
};

const QTY_EPS = new Decimal("0.00000001");

type Working = {
  instrumentId: string;
  symbol: string;
  quantity: Decimal;
  costBasis: Decimal;
};

function sortTx(a: LedgerTx, b: LedgerTx) {
  const date = a.occurredAt.localeCompare(b.occurredAt);
  if (date !== 0) return date;
  if (a.seq !== b.seq) return a.seq - b.seq;
  return a.id.localeCompare(b.id);
}

function symbolOf(tx: LedgerTx) {
  return tx.symbol ?? "position";
}

function positive(value: string | null, label: string, symbol: string, when: string) {
  const parsed = value === null || value.trim() === "" ? null : d(value);
  if (!parsed || parsed.lte(0)) {
    return { ok: false as const, error: `${label} for ${symbol} on ${when} must be greater than zero.` };
  }
  return { ok: true as const, value: parsed };
}

function nonNegative(value: string | null) {
  if (value === null || value.trim() === "") return new Decimal(0);
  return d(value);
}

function closeIfDust(pos: Working) {
  if (pos.quantity.abs().lte(QTY_EPS)) {
    pos.quantity = new Decimal(0);
    pos.costBasis = new Decimal(0);
  }
  if (pos.costBasis.lt(0)) pos.costBasis = new Decimal(0);
}

function heldError(verb: string, qty: Decimal, symbol: string, when: string, held: Decimal) {
  return `Cannot ${verb} ${toStorage(qty)} ${symbol} on ${when}. The book only has ${toStorage(held)} at that date.`;
}

function relieve(pos: Working, qty: Decimal) {
  const avg = pos.quantity.eq(0) ? new Decimal(0) : pos.costBasis.div(pos.quantity);
  pos.quantity = pos.quantity.minus(qty);
  pos.costBasis = Decimal.max(pos.costBasis.minus(avg.mul(qty)), 0);
  closeIfDust(pos);
  return avg.mul(qty);
}

export function deriveBook(transactions: LedgerTx[]): { ok: true; book: Book } | { ok: false; error: string } {
  const active = transactions.filter((tx) => !tx.voided).sort(sortTx);
  const positions = new Map<string, Working>();
  let cash = new Decimal(0);
  let realized = new Decimal(0);

  for (const tx of active) {
    const symbol = symbolOf(tx);
    const fee = nonNegative(tx.fee);
    if (fee.lt(0)) {
      return { ok: false, error: `Fee on ${symbol} cannot be negative.` };
    }

    if (tx.type === "BUY" || tx.type === "SELL") {
      if (!tx.instrumentId) {
        return { ok: false, error: `${tx.type === "BUY" ? "Buy" : "Sell"} on ${tx.occurredAt} needs a symbol.` };
      }
      const qty = positive(tx.quantity, "Quantity", symbol, tx.occurredAt);
      if (!qty.ok) return qty;
      const price = positive(tx.price, "Price", symbol, tx.occurredAt);
      if (!price.ok) return price;
      const pos = positions.get(tx.instrumentId) ?? {
        instrumentId: tx.instrumentId,
        symbol,
        quantity: new Decimal(0),
        costBasis: new Decimal(0),
      };
      if (tx.type === "BUY") {
        pos.quantity = pos.quantity.plus(qty.value);
        pos.costBasis = pos.costBasis.plus(qty.value.mul(price.value)).plus(fee);
        pos.symbol = symbol;
        positions.set(tx.instrumentId, pos);
        cash = cash.minus(qty.value.mul(price.value)).minus(fee);
      } else {
        if (qty.value.gt(pos.quantity.plus(QTY_EPS))) {
          return { ok: false, error: heldError("sell", qty.value, symbol, tx.occurredAt, pos.quantity) };
        }
        const relief = relieve(pos, qty.value);
        positions.set(tx.instrumentId, pos);
        const proceeds = qty.value.mul(price.value).minus(fee);
        cash = cash.plus(proceeds);
        realized = realized.plus(proceeds.minus(relief));
      }
      continue;
    }

    if (tx.instrumentId) {
      const qty = positive(tx.quantity, "Quantity", symbol, tx.occurredAt);
      if (!qty.ok) return qty;
      const pos = positions.get(tx.instrumentId) ?? {
        instrumentId: tx.instrumentId,
        symbol,
        quantity: new Decimal(0),
        costBasis: new Decimal(0),
      };
      if (tx.type === "DEPOSIT" || tx.type === "YIELD") {
        const basisPrice =
          tx.type === "YIELD" && (tx.price === null || tx.price.trim() === "")
            ? new Decimal(0)
            : nonNegative(tx.price);
        if (tx.type === "DEPOSIT" && (tx.price === null || tx.price.trim() === "")) {
          return {
            ok: false,
            error: `Enter a cost basis per unit for the ${symbol} deposit on ${tx.occurredAt}. Use 0 if the units have no cost.`,
          };
        }
        if (basisPrice.lt(0)) {
          return { ok: false, error: `Price for ${symbol} on ${tx.occurredAt} cannot be negative.` };
        }
        pos.quantity = pos.quantity.plus(qty.value);
        pos.costBasis = pos.costBasis.plus(qty.value.mul(basisPrice));
        pos.symbol = symbol;
        positions.set(tx.instrumentId, pos);
        cash = cash.minus(fee);
      } else if (tx.type === "WITHDRAWAL" || tx.type === "FEE") {
        if (qty.value.gt(pos.quantity.plus(QTY_EPS))) {
          const verb = tx.type === "FEE" ? "take a fee of" : "withdraw";
          return { ok: false, error: heldError(verb, qty.value, symbol, tx.occurredAt, pos.quantity) };
        }
        relieve(pos, qty.value);
        positions.set(tx.instrumentId, pos);
        cash = cash.minus(fee);
      } else {
        return { ok: false, error: `Unknown transaction type on ${tx.occurredAt}.` };
      }
      continue;
    }

    const amount = nonNegative(tx.amount).plus(tx.type === "FEE" ? fee : new Decimal(0));
    const cashFee = tx.type === "FEE" ? new Decimal(0) : fee;
    if (tx.type === "DEPOSIT" || tx.type === "YIELD") {
      if (amount.lte(0)) {
        return { ok: false, error: `Enter a cash amount for the ${tx.type.toLowerCase()} on ${tx.occurredAt}.` };
      }
      cash = cash.plus(amount).minus(cashFee);
    } else if (tx.type === "WITHDRAWAL" || tx.type === "FEE") {
      if (amount.lte(0)) {
        return { ok: false, error: `Enter a cash amount for the ${tx.type.toLowerCase()} on ${tx.occurredAt}.` };
      }
      cash = cash.minus(amount).minus(cashFee);
    } else {
      return { ok: false, error: `Unknown transaction type on ${tx.occurredAt}.` };
    }
  }

  const open = [...positions.values()]
    .filter((pos) => pos.quantity.gt(QTY_EPS))
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .map((pos) => ({
      instrumentId: pos.instrumentId,
      symbol: pos.symbol,
      quantity: toStorage(pos.quantity),
      costBasis: toStorage(pos.costBasis),
      averageCost: pos.quantity.eq(0) ? null : toStorage(pos.costBasis.div(pos.quantity)),
    }));

  return {
    ok: true,
    book: {
      cash: toStorage(cash),
      realizedPnl: toStorage(realized),
      positions: open,
    },
  };
}

export function cashImpact(tx: LedgerTx): string {
  const fee = d(tx.fee);
  const qty = d(tx.quantity);
  const price = d(tx.price);
  const amount = d(tx.amount);
  if (tx.type === "BUY") return toStorage(qty.mul(price).plus(fee).neg());
  if (tx.type === "SELL") return toStorage(qty.mul(price).minus(fee));
  if (tx.type === "DEPOSIT" || tx.type === "YIELD") {
    return tx.instrumentId ? toStorage(fee.neg()) : toStorage(amount.minus(fee));
  }
  if (tx.instrumentId) return toStorage(fee.neg());
  return toStorage(amount.plus(tx.type === "FEE" ? fee : fee).neg());
}

export function valueBook(
  book: Book,
  prices: Record<string, string | null>,
): {
  aum: string;
  positionsValue: string;
  unpriced: string[];
  lines: Array<Position & { price: string | null; marketValue: string | null; unrealizedPnl: string | null }>;
} {
  let positionsValue = new Decimal(0);
  const unpriced: string[] = [];
  const lines = book.positions.map((pos) => {
    const raw = prices[pos.instrumentId];
    if (raw === null || raw === undefined || raw === "") {
      unpriced.push(pos.symbol);
      return { ...pos, price: null, marketValue: null, unrealizedPnl: null };
    }
    const price = d(raw);
    const marketValue = price.mul(d(pos.quantity));
    positionsValue = positionsValue.plus(marketValue);
    return {
      ...pos,
      price: toStorage(price),
      marketValue: toStorage(marketValue),
      unrealizedPnl: toStorage(marketValue.minus(d(pos.costBasis))),
    };
  });
  return {
    aum: toStorage(positionsValue.plus(d(book.cash))),
    positionsValue: toStorage(positionsValue),
    unpriced,
    lines,
  };
}
