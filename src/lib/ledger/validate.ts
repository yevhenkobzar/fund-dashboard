import Decimal from "decimal.js";
import type { AssetClass, Sleeve, TxType } from "@/lib/domain";
import { parseAssetClass, parseSleeve, parseTxType } from "@/lib/domain";
import { deriveBook, type LedgerTx } from "@/lib/ledger/derive";
import { isBlank, parseDecimal } from "@/lib/money";

export type InstrumentRef = {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  sleeve: Sleeve;
};

export type DraftInput = {
  id?: string;
  occurredAt: string;
  type: string;
  symbol: string;
  name: string;
  assetClass: string;
  sleeve: string;
  quantity: string;
  price: string;
  amount: string;
  fee: string;
  notes: string;
};

export type NormalizedDraft = {
  tx: LedgerTx;
  symbol: string | null;
  createInstrument: {
    symbol: string;
    name: string;
    assetClass: AssetClass;
    sleeve: Sleeve;
  } | null;
};

const SYMBOL = /^[A-Z0-9][A-Z0-9.\-]{0,15}$/;
const LIMIT = new Decimal("1000000000000");

function fail(fieldErrors: Record<string, string>) {
  return { ok: false as const, fieldErrors };
}

function checkNumber(raw: string, field: string, label: string, errors: Record<string, string>, opts: { allowBlank?: boolean; allowZero?: boolean } = {}) {
  if (isBlank(raw)) {
    if (!opts.allowBlank) errors[field] = `Enter the ${label.toLowerCase()}.`;
    return null;
  }
  const parsed = parseDecimal(raw);
  if (!parsed) {
    errors[field] = `${label} must be a plain number.`;
    return null;
  }
  if (parsed.lt(0) || (!opts.allowZero && parsed.eq(0))) {
    errors[field] = opts.allowZero ? `${label} cannot be negative.` : `${label} must be greater than zero.`;
    return null;
  }
  if (parsed.abs().gte(LIMIT)) {
    errors[field] = `${label} is too large.`;
    return null;
  }
  return parsed;
}

export function normalizeDraft(
  input: DraftInput,
  instruments: InstrumentRef[],
  seq = Date.now(),
): { ok: true; value: NormalizedDraft } | { ok: false; fieldErrors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const type = parseTxType(input.type);
  if (!type) errors.type = "Choose a transaction type.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredAt)) {
    errors.occurredAt = "Enter a date.";
  } else if (input.occurredAt > new Date().toISOString().slice(0, 10)) {
    errors.occurredAt = "Date cannot be in the future.";
  }
  if (input.notes.trim().length > 2000) errors.notes = "Notes must be 2000 characters or fewer.";

  const symbol = input.symbol.trim().toUpperCase();
  const wantsAsset = type === "BUY" || type === "SELL" || symbol.length > 0;
  const cashOnly = type === "DEPOSIT" || type === "WITHDRAWAL" || type === "FEE" || type === "YIELD";

  if ((type === "BUY" || type === "SELL") && !symbol) {
    errors.symbol = "Enter a symbol.";
  }
  if (symbol && !SYMBOL.test(symbol)) {
    errors.symbol = "Use letters, numbers, dots, or hyphens, up to 16 characters.";
  }
  if (cashOnly && symbol && !isBlank(input.amount)) {
    errors.amount = "Use a symbol for an in-kind movement, or a cash amount, not both.";
  }

  const fee = checkNumber(input.fee, "fee", "Fee", errors, { allowBlank: true, allowZero: true });
  const quantity = checkNumber(input.quantity, "quantity", "Quantity", errors, {
    allowBlank: !wantsAsset,
  });
  const priceRequired = type === "BUY" || type === "SELL" || (type === "DEPOSIT" && Boolean(symbol));
  const priceOptional = type === "YIELD" && Boolean(symbol);
  const price = checkNumber(input.price, "price", "Price", errors, {
    allowBlank: !priceRequired,
    allowZero: priceOptional || (type === "DEPOSIT" && Boolean(symbol)),
  });
  const amount = checkNumber(input.amount, "amount", "Amount", errors, {
    allowBlank: wantsAsset || !cashOnly,
  });

  let createInstrument: NormalizedDraft["createInstrument"] = null;
  let instrumentId: string | null = null;
  if (symbol && !errors.symbol) {
    const existing = instruments.find((item) => item.symbol === symbol);
    if (existing) {
      instrumentId = existing.id;
      if (input.assetClass && parseAssetClass(input.assetClass) && parseAssetClass(input.assetClass) !== existing.assetClass) {
        errors.assetClass = `${symbol} is already classified as ${existing.assetClass}. Change it on the holding, not on this trade.`;
      }
      if (input.sleeve && parseSleeve(input.sleeve) && parseSleeve(input.sleeve) !== existing.sleeve) {
        errors.sleeve = `${symbol} is already in another sleeve. Change it on the holding, not on this trade.`;
      }
    } else {
      const assetClass = parseAssetClass(input.assetClass);
      const sleeve = parseSleeve(input.sleeve);
      const name = input.name.trim();
      if (!name) errors.name = "Enter a name for this new symbol.";
      else if (name.length > 80) errors.name = "Name must be 80 characters or fewer.";
      if (!assetClass) errors.assetClass = "Choose an asset class.";
      if (!sleeve) errors.sleeve = "Choose a sleeve.";
      if (name && assetClass && sleeve) {
        createInstrument = { symbol, name, assetClass, sleeve };
        instrumentId = `new:${symbol}`;
      }
    }
  }

  if (Object.keys(errors).length > 0 || !type) return fail(errors);

  const assetLeg = Boolean(symbol);
  const tx: LedgerTx = {
    id: input.id ?? `draft:${symbol || "cash"}:${input.occurredAt}`,
    occurredAt: input.occurredAt,
    seq,
    type: type as TxType,
    instrumentId: assetLeg ? instrumentId : null,
    symbol: assetLeg ? symbol : null,
    quantity: assetLeg && quantity ? quantity.toString() : null,
    price: assetLeg && price ? price.toString() : null,
    amount: assetLeg ? null : amount ? amount.toString() : null,
    fee: fee ? fee.toString() : "0",
    voided: false,
  };

  const book = deriveBook([tx]);
  if (!book.ok && !book.error.includes("only has")) {
    const field = book.error.toLowerCase().includes("quantity")
      ? "quantity"
      : book.error.toLowerCase().includes("price") || book.error.toLowerCase().includes("cost")
        ? "price"
        : book.error.toLowerCase().includes("amount") || book.error.toLowerCase().includes("cash")
          ? "amount"
          : "form";
    return fail({ [field]: book.error });
  }

  return { ok: true, value: { tx, symbol: symbol || null, createInstrument } };
}

export function assessBook(transactions: LedgerTx[]) {
  return deriveBook(transactions);
}
