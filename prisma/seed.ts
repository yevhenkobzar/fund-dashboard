import { PrismaClient, type AssetClass, type Sleeve, type TxType } from "@prisma/client";
import { deriveBook, valueBook, type LedgerTx } from "../src/lib/ledger/derive";
import { toStorage } from "../src/lib/money";
import { shouldSeedExampleData } from "../src/lib/seed-policy";

const prisma = new PrismaClient();

function day(iso: string) {
  return new Date(`${iso}T12:00:00.000Z`);
}

const instruments: {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  sleeve: Sleeve;
  start: number;
  end: number;
}[] = [
  { symbol: "BTC", name: "Bitcoin", assetClass: "CRYPTO", sleeve: "CRYPTO", start: 64200, end: 68420 },
  { symbol: "ETH", name: "Ether", assetClass: "CRYPTO", sleeve: "CRYPTO", start: 2280, end: 2625 },
  { symbol: "SOL", name: "Solana", assetClass: "CRYPTO", sleeve: "CRYPTO", start: 132, end: 148 },
  { symbol: "AAPL", name: "Apple", assetClass: "STOCK", sleeve: "STOCKS", start: 192, end: 228 },
  { symbol: "MSFT", name: "Microsoft", assetClass: "STOCK", sleeve: "STOCKS", start: 408, end: 431 },
  { symbol: "AI-INFRA", name: "AI infrastructure basket", assetClass: "THEMATIC_BASKET", sleeve: "THEMATIC", start: 24.5, end: 28.4 },
  { symbol: "SUSDE", name: "Ethena sUSDe", assetClass: "DEFI_YIELD", sleeve: "DEFI_YIELD", start: 1, end: 1 },
  { symbol: "BTC-PERP", name: "Bitcoin perpetual basis", assetClass: "CRYPTO", sleeve: "ARBITRAGE", start: 65500, end: 70150 },
];

const trades: {
  ref: string;
  date: string;
  type: TxType;
  symbol?: string;
  quantity?: string;
  price?: string;
  amount?: string;
  fee?: string;
  notes: string;
}[] = [
  { ref: "example-dep-1", date: "2026-04-01", type: "DEPOSIT", amount: "2000000", notes: "Example: initial capital" },
  { ref: "example-btc-1", date: "2026-04-02", type: "BUY", symbol: "BTC", quantity: "6", price: "64200", fee: "40", notes: "Example: core crypto sleeve" },
  { ref: "example-eth-1", date: "2026-04-02", type: "BUY", symbol: "ETH", quantity: "120", price: "2280", fee: "25", notes: "Example: core crypto sleeve" },
  { ref: "example-sol-1", date: "2026-04-03", type: "BUY", symbol: "SOL", quantity: "800", price: "132", fee: "10", notes: "Example: smaller crypto line" },
  { ref: "example-aapl-1", date: "2026-04-06", type: "BUY", symbol: "AAPL", quantity: "600", price: "192", fee: "8", notes: "Example: stock sleeve" },
  { ref: "example-msft-1", date: "2026-04-06", type: "BUY", symbol: "MSFT", quantity: "250", price: "408", fee: "8", notes: "Example: stock sleeve" },
  { ref: "example-basket-1", date: "2026-04-08", type: "BUY", symbol: "AI-INFRA", quantity: "15000", price: "24.5", notes: "Example: thematic basket" },
  { ref: "example-susde-1", date: "2026-04-10", type: "DEPOSIT", symbol: "SUSDE", quantity: "180000", price: "1", notes: "Example: DeFi yield allocation" },
  { ref: "example-perp-1", date: "2026-04-15", type: "BUY", symbol: "BTC-PERP", quantity: "2.5", price: "65500", fee: "30", notes: "Example: arbitrage sleeve" },
  { ref: "example-yield-5", date: "2026-05-01", type: "YIELD", symbol: "SUSDE", quantity: "620", notes: "Example: May yield, carried at zero cost" },
  { ref: "example-btc-2", date: "2026-05-20", type: "BUY", symbol: "BTC", quantity: "1", price: "67100", fee: "15", notes: "Example: add to crypto sleeve" },
  { ref: "example-yield-6", date: "2026-06-01", type: "YIELD", symbol: "SUSDE", quantity: "640", notes: "Example: June yield" },
  { ref: "example-fee-1", date: "2026-06-30", type: "FEE", amount: "4500", notes: "Example: operating costs" },
  { ref: "example-yield-7", date: "2026-07-01", type: "YIELD", symbol: "SUSDE", quantity: "655", notes: "Example: July yield" },
  { ref: "example-perp-2", date: "2026-07-20", type: "SELL", symbol: "BTC-PERP", quantity: "0.8", price: "68800", fee: "20", notes: "Example: basis harvest" },
  { ref: "example-yield-8", date: "2026-08-01", type: "YIELD", symbol: "SUSDE", quantity: "670", notes: "Example: August yield" },
  { ref: "example-aapl-2", date: "2026-08-12", type: "SELL", symbol: "AAPL", quantity: "150", price: "214", fee: "5", notes: "Example: trim stock sleeve" },
  { ref: "example-yield-9", date: "2026-09-01", type: "YIELD", symbol: "SUSDE", quantity: "690", notes: "Example: September yield" },
  { ref: "example-wd-1", date: "2026-09-15", type: "WITHDRAWAL", amount: "40000", notes: "Example: partner distribution" },
  { ref: "example-yield-10", date: "2026-10-01", type: "YIELD", symbol: "SUSDE", quantity: "710", notes: "Example: October yield" },
];

function mark(symbol: string, t: number) {
  const spec = instruments.find((item) => item.symbol === symbol);
  if (!spec) return 0;
  const wave = Math.sin(t * Math.PI * 3) * 0.018;
  return (spec.start + (spec.end - spec.start) * t) * (1 + wave);
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Set ADMIN_EMAIL before seeding. No password is stored.");
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", disabledAt: null },
    create: {
      email,
      name: process.env.ADMIN_NAME?.trim() || "Owner",
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  if (!shouldSeedExampleData()) {
    console.log(`Admin ensured: ${admin.email}. Example book skipped.`);
    return;
  }

  const [customTx, customArticle, customSnap, customInstrument] = await Promise.all([
    prisma.transaction.count({ where: { isExample: false } }),
    prisma.article.count({ where: { isExample: false } }),
    prisma.navSnapshot.count({ where: { isExample: false } }),
    prisma.instrument.count({ where: { isExample: false } }),
  ]);
  if (customTx + customArticle + customSnap + customInstrument > 0) {
    console.log("Custom book data is present. Left it in place and only ensured the admin.");
    return;
  }

  await prisma.article.deleteMany({ where: { isExample: true } });
  await prisma.transaction.deleteMany({ where: { isExample: true } });
  await prisma.navSnapshot.deleteMany({ where: { isExample: true } });
  await prisma.instrument.deleteMany({ where: { isExample: true } });
  await prisma.session.deleteMany({ where: { user: { isExample: true } } });
  await prisma.user.deleteMany({ where: { isExample: true, email: { not: admin.email } } });

  const editor = admin.email === "editor@example.com"
    ? admin
    : await prisma.user.upsert({
        where: { email: "editor@example.com" },
        update: { name: "Example editor", role: "EDITOR", isExample: true, disabledAt: null },
        create: { email: "editor@example.com", name: "Example editor", role: "EDITOR", isExample: true, emailVerified: new Date() },
      });
  if (admin.email !== "viewer@example.com") {
    await prisma.user.upsert({
      where: { email: "viewer@example.com" },
      update: { name: "Example viewer", role: "VIEWER", isExample: true, disabledAt: null },
      create: { email: "viewer@example.com", name: "Example viewer", role: "VIEWER", isExample: true, emailVerified: new Date() },
    });
  }

  const ids = new Map<string, string>();
  for (const spec of instruments) {
    const created = await prisma.instrument.create({
      data: {
        symbol: spec.symbol,
        name: spec.name,
        assetClass: spec.assetClass,
        sleeve: spec.sleeve,
        currentPrice: toStorage(spec.end),
        priceUpdatedAt: day("2026-10-24"),
        priceUpdatedBy: "example seed",
        isExample: true,
        notes: "Example instrument. Replace with the fund book.",
      },
    });
    ids.set(spec.symbol, created.id);
  }

  for (const [index, trade] of trades.entries()) {
    await prisma.transaction.create({
      data: {
        occurredAt: day(trade.date),
        type: trade.type,
        instrumentId: trade.symbol ? ids.get(trade.symbol) : null,
        quantity: trade.quantity ?? null,
        price: trade.price ?? null,
        amount: trade.amount ?? null,
        fee: trade.fee ?? "0",
        notes: trade.notes,
        externalRef: trade.ref,
        isExample: true,
        createdByEmail: admin.email,
        createdAt: new Date(day(trade.date).getTime() + index),
      },
    });
  }

  const stored = await prisma.transaction.findMany({
    where: { isExample: true, voidedAt: null },
    include: { instrument: { select: { symbol: true } } },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });
  const ledger: LedgerTx[] = stored.map((tx) => ({
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
    voided: false,
  }));

  const start = Date.parse("2026-04-03T00:00:00Z");
  const end = Date.parse("2026-10-23T00:00:00Z");
  for (let cursor = start; cursor <= end; cursor += 7 * 24 * 60 * 60 * 1000) {
    const iso = new Date(cursor).toISOString().slice(0, 10);
    const t = (cursor - start) / (end - start);
    const slice = ledger.filter((tx) => tx.occurredAt <= iso);
    const derived = deriveBook(slice);
    if (!derived.ok) throw new Error(`Example book failed on ${iso}: ${derived.error}`);
    const prices: Record<string, string> = {};
    for (const position of derived.book.positions) {
      prices[position.instrumentId] = toStorage(mark(position.symbol, t));
    }
    const valued = valueBook(derived.book, prices);
    await prisma.navSnapshot.create({
      data: {
        asOf: day(iso),
        aum: valued.aum,
        sharesOutstanding: "20000",
        navPerShare: toStorage(Number(valued.aum) / 20000),
        note: "Example snapshot, marked from the illustrative book.",
        isExample: true,
        createdByEmail: admin.email,
      },
    });
  }

  await prisma.article.create({
    data: {
      type: "MARKET_REVIEW",
      title: "Week of 20 October: funding, the basket, and a quieter tape",
      slug: "week-of-20-october",
      excerpt: "Example review. Invented observations for the sample book, not a view on live markets.",
      status: "PUBLISHED",
      publishedAt: day("2026-10-20"),
      isExample: true,
      authorId: admin.id,
      content: `Example review. The names and levels below belong to the sample book, not to a live market.

## What changed

Funding on the illustrative Bitcoin line cooled, and the AI infrastructure basket did more of the week's work than the stock sleeve. Cash is still the buffer after the September distribution.

## Sleeve notes

- Crypto: the sample BTC and ETH lines are marked above cost. SOL is the small residual.
- Stocks: Apple was trimmed in August in the example log. Microsoft is unchanged.
- Thematic: the basket is a single line item, not a look-through of constituents.
- DeFi yield: sUSDe units accrete with zero added cost in the example, so unrealized gain is mostly the yield itself.
- Arbitrage: part of the perpetual basis line was sold in July. What remains is still a manual position.

## Desk

Nothing in this note was pulled from an exchange. Replace it when the partnership writes its own week.
`,
    },
  });

  await prisma.article.create({
    data: {
      type: "MARKET_REVIEW",
      title: "Week of 27 October: draft, not for the partnership yet",
      slug: "week-of-27-october-draft",
      excerpt: "Example draft. Viewers should not see this.",
      status: "DRAFT",
      isExample: true,
      authorId: editor.id,
      content: `Example draft. This stays off the published list until an editor or admin publishes it.

A sentence to edit: the sample book's cash balance is whatever the transaction log currently derives. Do not treat this paragraph as a market view.
`,
    },
  });

  await prisma.article.create({
    data: {
      type: "RESEARCH",
      title: "Opportunity note: listed basis in the arbitrage sleeve",
      slug: "listed-basis-in-the-arbitrage-sleeve",
      excerpt: "Example research. A fictional note on how the sample arbitrage sleeve is booked.",
      status: "PUBLISHED",
      publishedAt: day("2026-10-16"),
      isExample: true,
      authorId: admin.id,
      content: `Example research article. It describes the sample book, not a recommendation.

## Setup in the example

The arbitrage sleeve is a single manual line, \`BTC-PERP\`, booked separately from spot BTC so the two sleeves do not share a cost basis. A July sale reduced the line. Average cost on what remains is derived from the original buy and that sale.

## What this does not do

There is no live basis feed, no funding accrual, and no broker connection. A later read-only adapter would still land in the same transaction log.

## Open question for a real book

Decide whether funding is yield, a fee, or a mark. The example uses none of those for the perpetual. It only has the buy and the partial sale.
`,
    },
  });

  await prisma.article.create({
    data: {
      type: "RESEARCH",
      title: "Draft: DeFi carry into year end",
      slug: "draft-defi-carry",
      excerpt: "Example research draft.",
      status: "DRAFT",
      isExample: true,
      authorId: editor.id,
      content: `Example draft for the research section.

The sample sUSDe position grows by monthly yield entries carried at zero cost. That is a booking choice, not a market forecast. Publish this only after it is rewritten for the actual sleeve.
`,
    },
  });

  const last = await prisma.navSnapshot.findFirst({ where: { isExample: true }, orderBy: { asOf: "desc" } });
  console.log(`Example book ready. Latest illustrative AUM: ${last?.aum ?? "n/a"}. Admin: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
