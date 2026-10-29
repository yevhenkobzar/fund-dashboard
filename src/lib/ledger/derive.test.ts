import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bookErrorFor, legsToLedger, parseTransactionCsv } from "@/lib/csv/transactions";
import { deriveBook, valueBook, type LedgerTx } from "@/lib/ledger/derive";
import { normalizeDraft } from "@/lib/ledger/validate";
import { d } from "@/lib/money";

function tx(partial: Partial<LedgerTx> & Pick<LedgerTx, "id" | "type" | "occurredAt">): LedgerTx {
  return {
    seq: 1,
    instrumentId: null,
    symbol: null,
    quantity: null,
    price: null,
    amount: null,
    fee: "0",
    voided: false,
    ...partial,
  };
}

describe("deriveBook", () => {
  it("capitalizes buy fees into average cost and reduces cash", () => {
    const result = deriveBook([
      tx({ id: "1", type: "DEPOSIT", occurredAt: "2026-01-01", amount: "100000", seq: 1 }),
      tx({
        id: "2",
        type: "BUY",
        occurredAt: "2026-01-02",
        instrumentId: "btc",
        symbol: "BTC",
        quantity: "1",
        price: "40000",
        fee: "50",
        seq: 2,
      }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.book.positions[0]).toMatchObject({
      symbol: "BTC",
      quantity: "1",
      costBasis: "40050",
      averageCost: "40050",
    });
    expect(result.book.cash).toBe("59950");
  });

  it("relieves average cost on a partial sale and records realized pnl", () => {
    const result = deriveBook([
      tx({
        id: "1",
        type: "BUY",
        occurredAt: "2026-01-01",
        instrumentId: "eth",
        symbol: "ETH",
        quantity: "10",
        price: "2000",
        seq: 1,
      }),
      tx({
        id: "2",
        type: "BUY",
        occurredAt: "2026-01-02",
        instrumentId: "eth",
        symbol: "ETH",
        quantity: "10",
        price: "3000",
        seq: 2,
      }),
      tx({
        id: "3",
        type: "SELL",
        occurredAt: "2026-01-03",
        instrumentId: "eth",
        symbol: "ETH",
        quantity: "5",
        price: "3200",
        fee: "10",
        seq: 3,
      }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.book.positions[0].quantity).toBe("15");
    expect(result.book.positions[0].averageCost).toBe("2500");
    expect(result.book.realizedPnl).toBe("3490");
    expect(result.book.cash).toBe("-34010");
  });

  it("rejects a sale that the book cannot cover at that date", () => {
    const result = deriveBook([
      tx({
        id: "sell",
        type: "SELL",
        occurredAt: "2026-01-01",
        instrumentId: "btc",
        symbol: "BTC",
        quantity: "2",
        price: "100",
        seq: 1,
      }),
      tx({
        id: "buy",
        type: "BUY",
        occurredAt: "2026-02-01",
        instrumentId: "btc",
        symbol: "BTC",
        quantity: "3",
        price: "100",
        seq: 2,
      }),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Cannot sell 2 BTC");
  });

  it("ignores voided rows and handles yield, fees, and in-kind transfers", () => {
    const result = deriveBook([
      tx({ id: "void", type: "BUY", occurredAt: "2026-01-01", instrumentId: "btc", symbol: "BTC", quantity: "9", price: "1", voided: true }),
      tx({ id: "dep", type: "DEPOSIT", occurredAt: "2026-01-02", instrumentId: "susde", symbol: "sUSDe", quantity: "100", price: "1", seq: 1 }),
      tx({ id: "yield", type: "YIELD", occurredAt: "2026-02-01", instrumentId: "susde", symbol: "sUSDe", quantity: "1", price: null, seq: 2 }),
      tx({ id: "fee", type: "FEE", occurredAt: "2026-02-02", instrumentId: "susde", symbol: "sUSDe", quantity: "0.5", seq: 3 }),
      tx({ id: "cashfee", type: "FEE", occurredAt: "2026-02-03", amount: "25", seq: 4 }),
      tx({ id: "wd", type: "WITHDRAWAL", occurredAt: "2026-02-04", amount: "10", seq: 5 }),
      tx({ id: "cashyield", type: "YIELD", occurredAt: "2026-02-05", amount: "8", seq: 6 }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.book.positions).toEqual([
      expect.objectContaining({ symbol: "sUSDe", quantity: "100.5", costBasis: "99.50495049505" }),
    ]);
    expect(result.book.cash).toBe("-27");
  });

  it("drops a position once it is fully withdrawn", () => {
    const result = deriveBook([
      tx({ id: "1", type: "DEPOSIT", occurredAt: "2026-01-01", instrumentId: "a", symbol: "AAPL", quantity: "4", price: "100", seq: 1 }),
      tx({ id: "2", type: "WITHDRAWAL", occurredAt: "2026-01-02", instrumentId: "a", symbol: "AAPL", quantity: "4", seq: 2 }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.book.positions).toEqual([]);
  });

  it("values priced positions and leaves unpriced names out of AUM", () => {
    const derived = deriveBook([
      tx({ id: "1", type: "BUY", occurredAt: "2026-01-01", instrumentId: "btc", symbol: "BTC", quantity: "2", price: "100", seq: 1 }),
      tx({ id: "2", type: "DEPOSIT", occurredAt: "2026-01-01", amount: "50", seq: 2 }),
    ]);
    expect(derived.ok).toBe(true);
    if (!derived.ok) return;
    const valued = valueBook(derived.book, { btc: "150" });
    expect(valued.positionsValue).toBe("300");
    expect(valued.aum).toBe("150");
    expect(valued.lines[0].unrealizedPnl).toBe("100");
    expect(d(valued.aum).eq(150)).toBe(true);
  });
});

describe("normalizeDraft", () => {
  it("requires a sleeve when the symbol is new", () => {
    const result = normalizeDraft(
      {
        occurredAt: "2026-01-01",
        type: "buy",
        symbol: "SOL",
        name: "Solana",
        assetClass: "crypto",
        sleeve: "",
        quantity: "1",
        price: "100",
        amount: "",
        fee: "",
        notes: "",
      },
      [],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.sleeve).toBeTruthy();
  });
});

describe("sample csv template", () => {
  it("imports into a valid book", () => {
    const csv = readFileSync("public/templates/transactions.csv", "utf8");
    const parsed = parseTransactionCsv(csv);
    expect(parsed.fileError).toBeNull();
    expect(parsed.rows.every((row) => row.errors.length === 0 && row.leg)).toBe(true);
    const symbols = new Map();
    const ledger = legsToLedger(
      parsed.rows.flatMap((row) => (row.leg ? [{ line: row.line, leg: row.leg }] : [])),
      symbols,
    );
    expect(ledger.errors).toEqual([]);
    expect(bookErrorFor([], ledger.txs)).toBeNull();
    const book = deriveBook(ledger.txs);
    expect(book.ok).toBe(true);
    if (!book.ok) return;
    expect(book.book.positions.map((pos) => pos.symbol).sort()).toEqual(["ETH", "NVDA", "TBILL-BASKET"]);
    expect(book.book.positions.find((pos) => pos.symbol === "ETH")?.quantity).toBe("10.04");
    expect(book.book.positions.find((pos) => pos.symbol === "NVDA")?.quantity).toBe("15");
  });
});
