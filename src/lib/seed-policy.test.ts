import { describe, expect, it } from "vitest";
import { shouldSeedExampleData } from "@/lib/seed-policy";

describe("shouldSeedExampleData", () => {
  it("loads the example book for local dev when the flag is unset", () => {
    expect(shouldSeedExampleData({ NODE_ENV: "development" })).toBe(true);
    expect(shouldSeedExampleData({})).toBe(true);
  });

  it("stays empty in production and on Vercel unless explicitly enabled", () => {
    expect(shouldSeedExampleData({ NODE_ENV: "production" })).toBe(false);
    expect(shouldSeedExampleData({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(false);
    expect(shouldSeedExampleData({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(false);
    expect(shouldSeedExampleData({ VERCEL_ENV: "production", SEED_EXAMPLE_DATA: "false" })).toBe(false);
  });

  it("honors an explicit true even in production", () => {
    expect(shouldSeedExampleData({ NODE_ENV: "production", SEED_EXAMPLE_DATA: "true" })).toBe(true);
  });
});
