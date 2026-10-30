/** Per-user accounts (magic links, roles, invites) stay in the code and stay off until this is true. */
export function accountsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.ACCOUNTS_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}
