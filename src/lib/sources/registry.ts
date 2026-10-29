/**
 * Data-source boundary for the book.
 *
 * v1 records holdings only from manual transactions and CSV import.
 * Sync adapters are intentionally empty. A later version can register a
 * read-only adapter here without changing how positions are derived.
 *
 * A sync adapter must not place orders, transfer funds, or request
 * withdrawal permission. It would translate a remote snapshot into book
 * rows, and deriveBook() would value them the same way as manual trades.
 */

export type SourceAvailability = "active" | "coming_soon";

export type HoldingSource = {
  id: string;
  name: string;
  availability: SourceAvailability;
  summary: string;
};

export const holdingSources: HoldingSource[] = [
  {
    id: "manual",
    name: "Manual book",
    availability: "active",
    summary: "Trades, transfers, fees, and yield entered on the desk. Positions and cost basis are derived from this log.",
  },
  {
    id: "csv",
    name: "CSV import",
    availability: "active",
    summary: "The same transaction types, loaded from a spreadsheet. Re-importing a row is safe when it has an external ref.",
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    availability: "coming_soon",
    summary: "Read-only account snapshot by wallet. Not connected in this version.",
  },
  {
    id: "lighter",
    name: "Lighter",
    availability: "coming_soon",
    summary: "Read-only account and positions. Not connected in this version.",
  },
  {
    id: "ibkr",
    name: "Interactive Brokers",
    availability: "coming_soon",
    summary: "Read-only Flex or Client Portal query. Not connected in this version.",
  },
];

export type SyncPullResult = {
  asOf: string;
  notes: string[];
};

export interface SyncAdapter {
  sourceId: string;
  pull(): Promise<SyncPullResult>;
}

/** Register future read-only adapters here. v1 ships none. */
export const syncAdapters: Readonly<Record<string, SyncAdapter>> = {};
