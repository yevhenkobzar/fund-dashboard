export function fundName() {
  const name = process.env.FUND_NAME?.trim();
  return name && name.length > 0 ? name : "[Fund Name]";
}
