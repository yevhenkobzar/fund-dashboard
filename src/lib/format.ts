import { d, toStorage } from "@/lib/money";

export function formatUsd(value: string | number): string {
  const n = d(value);
  const sign = n.isNegative() ? "-" : "";
  const [whole, frac] = n.abs().toFixed(2).split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}.${frac}`;
}

export function formatQty(value: string): string {
  const stored = toStorage(value);
  const [whole, frac = ""] = stored.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const trimmed = frac.replace(/0+$/, "").slice(0, 8);
  return trimmed ? `${withCommas}.${trimmed}` : withCommas;
}

export function formatPrice(value: string): string {
  const n = d(value);
  const digits = n.abs().gte(1000) ? 2 : n.abs().gte(1) ? 4 : 6;
  const sign = n.isNegative() ? "-" : "";
  const [whole, frac] = n.abs().toFixed(digits).split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}.${frac}`;
}

export function formatPct(part: string, whole: string): string {
  if (d(whole).eq(0)) return "—";
  return `${d(part).div(d(whole)).mul(100).toFixed(1)}%`;
}

export function formatSignedUsd(value: string): string {
  const n = d(value);
  const body = formatUsd(n.abs().toString());
  if (n.gt(0)) return `+${body}`;
  if (n.lt(0)) return `-${body}`;
  return body;
}

export function pnlClass(value: string): string {
  const n = d(value);
  if (n.gt(0)) return "text-positive";
  if (n.lt(0)) return "text-danger";
  return "text-muted-foreground";
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function dateInputValue(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}
