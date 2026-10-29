import { parseAssetClass, parseSleeve, parseTxType, type AssetClass, type Sleeve, type TxType } from "@/lib/domain";
import { parseCsv } from "@/lib/csv/parse";
import { deriveBook, type LedgerTx } from "@/lib/ledger/derive";
import { isBlank, parseDecimal } from "@/lib/money";

export const CSV_COLUMNS = [
  "occurred_at",
  "type",
  "symbol",
  "name",
  "asset_class",
  "sleeve",
  "quantity",
  "price",
  "amount",
  "fee",
  "notes",
  "external_ref",
] as const;

export type ParsedLeg = {
  occurredAt: string;
  type: TxType;
  symbol: string | null;
  name: string | null;
  assetClass: AssetClass | null;
  sleeve: Sleeve | null;
  quantity: string | null;
  price: string | null;
  amount: string | null;
  fee: string;
  notes: string | null;
  externalRef: string | null;
};

export type ParsedRow = {
  line: number;
  errors: string[];
  leg: ParsedLeg | null;
  summary: string;
};

function col(header: string[], row: string[], name: string) {
  const index = header.indexOf(name);
  if (index < 0) return "";
  return (row[index] ?? "").trim();
}

function numberOrError(raw: string, label: string, errors: string[], opts: { blank: "zero" | "null" | "error"; zero: boolean }) {
  if (isBlank(raw)) {
    if (opts.blank === "error") errors.push(`${label} is required.`);
    if (opts.blank === "zero") return "0";
    return null;
  }
  const parsed = parseDecimal(raw);
  if (!parsed) {
    errors.push(`${label} must be a plain number.`);
    return null;
  }
  if (parsed.lt(0) || (!opts.zero && parsed.eq(0))) {
    errors.push(opts.zero ? `${label} cannot be negative.` : `${label} must be greater than zero.`);
    return null;
  }
  return parsed.toString();
}

export function parseTransactionCsv(text: string): { fileError: string | null; rows: ParsedRow[] } {
  if (text.length > 1_000_000) {
    return { fileError: "This file is larger than 1 MB.", rows: [] };
  }
  const table = parseCsv(text);
  if (table.length === 0) return { fileError: "The file is empty.", rows: [] };
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  for (const required of ["occurred_at", "type"]) {
    if (!header.includes(required)) {
      return { fileError: `Missing required column "${required}".`, rows: [] };
    }
  }
  const seen = new Set<string>();
  const rows: ParsedRow[] = [];
  table.slice(1).forEach((row, index) => {
    const line = index + 2;
    const errors: string[] = [];
    const occurredAt = col(header, row, "occurred_at");
    const type = parseTxType(col(header, row, "type"));
    const symbolRaw = col(header, row, "symbol").toUpperCase();
    const name = col(header, row, "name");
    const assetRaw = col(header, row, "asset_class");
    const sleeveRaw = col(header, row, "sleeve");
    const notes = col(header, row, "notes");
    const externalRef = col(header, row, "external_ref");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) errors.push("occurred_at must be YYYY-MM-DD.");
    else if (occurredAt > new Date().toISOString().slice(0, 10)) errors.push("occurred_at cannot be in the future.");
    if (!type) errors.push('type must be buy, sell, deposit, withdrawal, fee, or yield.');
    if (symbolRaw && !/^[A-Z0-9][A-Z0-9.\-]{0,15}$/.test(symbolRaw)) {
      errors.push("symbol must be 1–16 letters, numbers, dots, or hyphens.");
    }
    if (externalRef) {
      if (seen.has(externalRef)) errors.push(`external_ref "${externalRef}" is repeated in this file.`);
      seen.add(externalRef);
    }
    if (notes.length > 2000) errors.push("notes must be 2000 characters or fewer.");

    const wantsAsset = type === "BUY" || type === "SELL" || symbolRaw.length > 0;
    if ((type === "BUY" || type === "SELL") && !symbolRaw) errors.push("buy and sell rows need a symbol.");
    if (symbolRaw && !isBlank(col(header, row, "amount")) && type !== "BUY" && type !== "SELL") {
      errors.push("use a symbol or a cash amount, not both.");
    }

    const quantity = numberOrError(col(header, row, "quantity"), "quantity", errors, {
      blank: wantsAsset ? "error" : "null",
      zero: false,
    });
    const priceBlank = !(type === "BUY" || type === "SELL" || (type === "DEPOSIT" && symbolRaw));
    const price = numberOrError(col(header, row, "price"), "price", errors, {
      blank: priceBlank ? "null" : "error",
      zero: type === "DEPOSIT" || type === "YIELD",
    });
    const amount = numberOrError(col(header, row, "amount"), "amount", errors, {
      blank: wantsAsset ? "null" : "error",
      zero: false,
    });
    const fee = numberOrError(col(header, row, "fee"), "fee", errors, { blank: "zero", zero: true });

    let assetClass: AssetClass | null = null;
    let sleeve: Sleeve | null = null;
    if (assetRaw) {
      assetClass = parseAssetClass(assetRaw);
      if (!assetClass) errors.push("asset_class is not recognized.");
    }
    if (sleeveRaw) {
      sleeve = parseSleeve(sleeveRaw);
      if (!sleeve) errors.push("sleeve is not recognized.");
    }

    const typeLabel = type ? type.toLowerCase() : col(header, row, "type") || "?";
    const summary = `${occurredAt || "?"} ${typeLabel} ${symbolRaw || "cash"}`.trim();
    if (!type || errors.length > 0) {
      rows.push({ line, errors, leg: null, summary });
      return;
    }
    rows.push({
      line,
      errors,
      summary,
      leg: {
        occurredAt,
        type,
        symbol: symbolRaw || null,
        name: name || null,
        assetClass,
        sleeve,
        quantity,
        price,
        amount,
        fee: fee ?? "0",
        notes: notes || null,
        externalRef: externalRef || null,
      },
    });
  });
  if (rows.length === 0) return { fileError: "The file has a header but no data rows.", rows: [] };
  if (rows.length > 2000) return { fileError: "Import at most 2000 rows at a time.", rows: [] };
  return { fileError: null, rows };
}

export function legsToLedger(
  rows: { line: number; leg: ParsedLeg }[],
  symbols: Map<string, { id: string; assetClass: AssetClass; sleeve: Sleeve }>,
): { txs: LedgerTx[]; errors: { line: number; message: string }[] } {
  const errors: { line: number; message: string }[] = [];
  const txs: LedgerTx[] = [];
  rows.forEach(({ leg, line }, index) => {
    if (!leg.symbol) {
      txs.push({
        id: `csv:${leg.externalRef ?? line}`,
        occurredAt: leg.occurredAt,
        seq: 9_000_000_000_000 + index,
        type: leg.type,
        instrumentId: null,
        symbol: null,
        quantity: leg.quantity,
        price: leg.price,
        amount: leg.amount,
        fee: leg.fee,
        voided: false,
      });
      return;
    }
    const known = symbols.get(leg.symbol);
    if (!known) {
      if (!leg.name) errors.push({ line, message: `${leg.symbol} is new and needs a name.` });
      if (!leg.assetClass) errors.push({ line, message: `${leg.symbol} is new and needs an asset_class.` });
      if (!leg.sleeve) errors.push({ line, message: `${leg.symbol} is new and needs a sleeve.` });
      if (leg.name && leg.assetClass && leg.sleeve) {
        symbols.set(leg.symbol, { id: `new:${leg.symbol}`, assetClass: leg.assetClass, sleeve: leg.sleeve });
      }
    } else if (!known.id.startsWith("new:")) {
      if (leg.assetClass && leg.assetClass !== known.assetClass) {
        errors.push({ line, message: `${leg.symbol} is already classified differently.` });
      }
      if (leg.sleeve && leg.sleeve !== known.sleeve) {
        errors.push({ line, message: `${leg.symbol} is already in a different sleeve.` });
      }
    }
    const id = symbols.get(leg.symbol)?.id ?? `new:${leg.symbol}`;
    txs.push({
      id: `csv:${leg.externalRef ?? line}`,
      occurredAt: leg.occurredAt,
      seq: 9_000_000_000_000 + index,
      type: leg.type,
      instrumentId: id,
      symbol: leg.symbol,
      quantity: leg.quantity,
      price: leg.price,
      amount: leg.amount,
      fee: leg.fee,
      voided: false,
    });
  });
  return { txs, errors };
}

export function bookErrorFor(existing: LedgerTx[], incoming: LedgerTx[]) {
  const result = deriveBook([...existing, ...incoming]);
  return result.ok ? null : result.error;
}

export type ImportPlanRow = {
  line: number;
  summary: string;
  status: "ready" | "invalid" | "duplicate";
  detail: string;
};

export type ImportPlan = {
  fileError: string | null;
  rows: ImportPlanRow[];
  readyCount: number;
  bookError: string | null;
};

export function planCsvImport(input: {
  csv: string;
  instruments: { id: string; symbol: string; assetClass: AssetClass; sleeve: Sleeve }[];
  existing: LedgerTx[];
  externalRefs: string[];
}): ImportPlan {
  const parsed = parseTransactionCsv(input.csv);
  if (parsed.fileError) {
    return { fileError: parsed.fileError, rows: [], readyCount: 0, bookError: null };
  }
  const knownRefs = new Set(input.externalRefs);
  const rows: ImportPlanRow[] = [];
  const ready: { line: number; leg: ParsedLeg }[] = [];
  for (const row of parsed.rows) {
    if (row.errors.length > 0 || !row.leg) {
      rows.push({
        line: row.line,
        summary: row.summary,
        status: "invalid",
        detail: row.errors.join(" "),
      });
      continue;
    }
    if (row.leg.externalRef && knownRefs.has(row.leg.externalRef)) {
      rows.push({
        line: row.line,
        summary: row.summary,
        status: "duplicate",
        detail: "This external ref is already in the book, so the row will be skipped.",
      });
      continue;
    }
    rows.push({
      line: row.line,
      summary: row.summary,
      status: "ready",
      detail: "Ready to add.",
    });
    ready.push({ line: row.line, leg: row.leg });
  }
  let bookError: string | null = null;
  if (rows.some((row) => row.status === "invalid")) {
    bookError = "Fix the invalid rows before importing. Nothing has been saved.";
  } else if (ready.length > 0) {
    const symbols = new Map(
      input.instruments.map((instrument) => [
        instrument.symbol,
        { id: instrument.id, assetClass: instrument.assetClass, sleeve: instrument.sleeve },
      ]),
    );
    const ledger = legsToLedger(ready, symbols);
    bookError = ledger.errors.length
      ? ledger.errors.map((error) => `Line ${error.line}: ${error.message}`).join(" ")
      : bookErrorFor(input.existing, ledger.txs);
  }
  return { fileError: null, rows, readyCount: ready.length, bookError };
}
