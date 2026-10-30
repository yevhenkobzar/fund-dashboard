/**
 * Example book is opt-in outside production.
 * Vercel production and preview deploys stay empty unless SEED_EXAMPLE_DATA=true.
 */
export function shouldSeedExampleData(env: {
  SEED_EXAMPLE_DATA?: string;
  NODE_ENV?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
} = process.env): boolean {
  const raw = env.SEED_EXAMPLE_DATA?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  if (env.VERCEL || env.VERCEL_ENV) return false;
  if (env.NODE_ENV === "production") return false;
  return true;
}
