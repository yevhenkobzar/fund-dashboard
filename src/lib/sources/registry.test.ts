import { describe, expect, it } from "vitest";
import { holdingSources, syncAdapters } from "@/lib/sources/registry";
import { priceFetcher } from "@/lib/prices/fetcher";

describe("data sources", () => {
  it("ships no live sync adapters and no required venue credentials", () => {
    expect(Object.keys(syncAdapters)).toEqual([]);
    expect(priceFetcher).toBeNull();
    for (const id of ["hyperliquid", "lighter", "ibkr"]) {
      expect(holdingSources.find((source) => source.id === id)?.availability).toBe("coming_soon");
    }
    expect(holdingSources.filter((source) => source.availability === "active").map((source) => source.id)).toEqual([
      "manual",
      "csv",
    ]);
  });
});
