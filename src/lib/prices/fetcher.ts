/**
 * Price hook.
 *
 * v1 uses marks typed in by the desk. To suggest prices from a market-data
 * source later, export a fetcher from this module. Do not overwrite a stored
 * mark unless a person confirms it.
 */
export type PriceQuote = {
  symbol: string;
  price: string;
  asOf: string;
};

export type PriceFetcher = {
  id: string;
  label: string;
  fetchQuotes(symbols: string[]): Promise<PriceQuote[]>;
};

export const priceFetcher: PriceFetcher | null = null;
