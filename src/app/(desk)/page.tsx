import Link from "next/link";
import { authorize } from "@/lib/auth/permissions";
import { ASSET_COLOR, ASSET_LABEL, SECTIONS, SLEEVE_COLOR, SLEEVE_LABEL, type AssetClass, type Sleeve } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { formatDate, formatSignedUsd, formatUsd, pnlClass } from "@/lib/format";
import { d, toStorage } from "@/lib/money";
import { AllocationChart, PerformanceChart } from "@/components/charts";
import { ExampleBanner, Panel } from "@/components/page-header";
import { requireUser } from "@/server/guard";
import { deskHasExampleCopy, loadBook } from "@/server/queries";

function slices(
  lines: { sleeve: Sleeve; assetClass: AssetClass; marketValue: string | null }[],
  cash: string,
  key: "sleeve" | "assetClass",
) {
  const totals = new Map<string, ReturnType<typeof d>>();
  for (const line of lines) {
    if (!line.marketValue) continue;
    const id = line[key];
    totals.set(id, (totals.get(id) ?? d(0)).plus(d(line.marketValue)));
  }
  if (d(cash).gt(0)) totals.set("CASH", d(cash));
  const total = [...totals.values()].reduce((sum, value) => sum.plus(value), d(0));
  return [...totals.entries()]
    .map(([id, value]) => ({
      name: id === "CASH" ? "Cash" : key === "sleeve" ? SLEEVE_LABEL[id as Sleeve] : ASSET_LABEL[id as AssetClass],
      value: Number(value.toFixed(2)),
      display: toStorage(value),
      weight: total.eq(0) ? "0" : value.div(total).mul(100).toFixed(1),
      fill: id === "CASH" ? "#c4b49a" : key === "sleeve" ? SLEEVE_COLOR[id as Sleeve] : ASSET_COLOR[id as AssetClass],
    }))
    .sort((a, b) => b.value - a.value);
}

export default async function OverviewPage() {
  const user = await requireUser();
  const book = await loadBook();
  const exampleCopy = await deskHasExampleCopy();
  const canWrite = authorize(user.role, "write_article");
  const [reviews, research, reviewDrafts, researchDrafts] = await Promise.all([
    prisma.article.findMany({ where: { type: "MARKET_REVIEW", status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 3 }),
    prisma.article.findMany({ where: { type: "RESEARCH", status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 3 }),
    canWrite ? prisma.article.count({ where: { type: "MARKET_REVIEW", status: "DRAFT" } }) : Promise.resolve(0),
    canWrite ? prisma.article.count({ where: { type: "RESEARCH", status: "DRAFT" } }) : Promise.resolve(0),
  ]);
  const valued = book.valued;
  const aum = valued?.aum ?? "0";
  const previous = book.snapshots.length > 1 ? book.snapshots[book.snapshots.length - 2] : null;
  const latest = book.snapshots.at(-1);
  const joined = (valued?.lines ?? []).map((line) => {
    const instrument = book.instruments.find((item) => item.id === line.instrumentId);
    return { ...line, sleeve: instrument?.sleeve ?? "CRYPTO", assetClass: instrument?.assetClass ?? "CRYPTO" };
  });
  const bySleeve = slices(joined, book.derived.ok ? book.derived.book.cash : "0", "sleeve");
  const byClass = slices(joined, book.derived.ok ? book.derived.book.cash : "0", "assetClass");
  const points = book.snapshots.map((snapshot) => ({
    date: formatDate(snapshot.asOf),
    aum: Number(snapshot.aum),
    nav: snapshot.navPerShare ? Number(snapshot.navPerShare) : null,
  }));

  return (
    <div>
      <ExampleBanner show={book.hasExample || exampleCopy} />
      <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Partnership book</p>
      <h1 className="mt-1 font-serif text-4xl tracking-tight">Overview</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        AUM is the current manual book. The chart uses snapshots the desk records. Marks are only as fresh as the last price update.
      </p>
      {!book.derived.ok ? <p className="mt-4 text-sm text-danger">{book.derived.error}</p> : null}
      {valued && valued.unpriced.length > 0 ? (
        <p className="mt-4 text-sm text-brass">Unpriced and excluded from AUM: {valued.unpriced.join(", ")}.</p>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="AUM" value={valued ? formatUsd(aum) : "—"} hint={latest ? `Last snapshot ${formatDate(latest.asOf)}` : "No snapshot yet"} />
        <Stat label="Cash" value={book.derived.ok ? formatUsd(book.derived.book.cash) : "—"} hint={book.derived.ok && d(book.derived.book.cash).lt(0) ? "Cash is negative" : "Uninvested balance"} />
        <Stat label="Market value" value={valued ? formatUsd(valued.positionsValue) : "—"} hint="Priced positions" />
        <Stat label="Unrealized" value={book.unrealized ? formatSignedUsd(book.unrealized) : "—"} hint={previous ? `Prior snapshot ${formatUsd(previous.aum)}` : "Versus cost basis"} className={book.unrealized ? pnlClass(book.unrealized) : ""} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="By sleeve">
          <AllocationChart slices={bySleeve} />
          <Legend rows={bySleeve} />
        </Panel>
        <Panel title="By asset class">
          <AllocationChart slices={byClass} />
          <Legend rows={byClass} />
        </Panel>
      </div>
      <Panel title="Performance" className="mt-4">
        <PerformanceChart points={points} />
        <Link href="/performance" className="mt-2 inline-block text-sm text-primary">Record or review snapshots</Link>
      </Panel>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ArticleColumn title={SECTIONS.MARKET_REVIEW.title} href="/reviews" articles={reviews} drafts={reviewDrafts} />
        <ArticleColumn title={SECTIONS.RESEARCH.title} href="/research" articles={research} drafts={researchDrafts} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint, className }: { label: string; value: string; hint: string; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-3xl tabular-nums ${className ?? ""}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Legend({ rows }: { rows: { name: string; display: string; weight: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {rows.map((row) => (
        <li key={row.name} className="flex justify-between gap-3">
          <span>{row.name}</span>
          <span className="tabular-nums text-muted-foreground">{formatUsd(row.display)} · {row.weight}%</span>
        </li>
      ))}
    </ul>
  );
}

function ArticleColumn({
  title,
  href,
  articles,
  drafts,
}: {
  title: string;
  href: string;
  articles: { slug: string; title: string; publishedAt: Date | null }[];
  drafts: number;
}) {
  return (
    <Panel title={title}>
      {articles.length === 0 ? <p className="text-sm text-muted-foreground">Nothing published yet.</p> : (
        <ul className="space-y-3">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link href={`${href}/${article.slug}`} className="font-medium hover:underline">{article.title}</Link>
              {article.publishedAt ? <p className="text-xs text-muted-foreground">{formatDate(article.publishedAt)}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm">
        <Link href={href} className="text-primary">Open section</Link>
        {drafts > 0 ? <span className="text-muted-foreground"> · {drafts} draft{drafts === 1 ? "" : "s"}</span> : null}
      </p>
    </Panel>
  );
}
