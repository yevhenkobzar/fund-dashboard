import type { Instrument, Transaction } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deriveBook, valueBook, type LedgerTx } from "@/lib/ledger/derive";
import { d, toStorage } from "@/lib/money";

export type LedgerRow = Transaction & { instrument: { symbol: string } | null };

export function toLedger(tx: LedgerRow): LedgerTx {
  return {
    id: tx.id,
    occurredAt: tx.occurredAt.toISOString().slice(0, 10),
    seq: tx.createdAt.getTime(),
    type: tx.type,
    instrumentId: tx.instrumentId,
    symbol: tx.instrument?.symbol ?? null,
    quantity: tx.quantity,
    price: tx.price,
    amount: tx.amount,
    fee: tx.fee,
    voided: Boolean(tx.voidedAt),
  };
}

export async function loadLedgerRows() {
  return prisma.transaction.findMany({
    include: { instrument: { select: { symbol: true } } },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function loadInstruments() {
  return prisma.instrument.findMany({ orderBy: { symbol: "asc" } });
}

export function buildBook(rows: LedgerRow[], instruments: Instrument[]) {
  const ledger = rows.map(toLedger);
  const active = ledger.filter((tx) => !tx.voided);
  const derived = deriveBook(active);
  const prices = Object.fromEntries(instruments.map((instrument) => [instrument.id, instrument.currentPrice]));
  const valued = derived.ok ? valueBook(derived.book, prices) : null;
  const unrealized = valued
    ? toStorage(
        valued.lines.reduce((sum, line) => sum.plus(line.unrealizedPnl ? d(line.unrealizedPnl) : d(0)), d(0)),
      )
    : null;
  return { ledger, active, derived, valued, unrealized };
}

export async function loadBook() {
  const [rows, instruments, snapshots] = await Promise.all([
    loadLedgerRows(),
    loadInstruments(),
    prisma.navSnapshot.findMany({ where: { voidedAt: null }, orderBy: { asOf: "asc" } }),
  ]);
  const book = buildBook(rows, instruments);
  const hasExample =
    instruments.some((instrument) => instrument.isExample) ||
    rows.some((row) => row.isExample) ||
    snapshots.some((snapshot) => snapshot.isExample);
  return { rows, instruments, snapshots, hasExample, ...book };
}

export async function deskHasExampleCopy() {
  const articles = await prisma.article.count({ where: { isExample: true } });
  return articles > 0;
}
