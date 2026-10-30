"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ArticleType, AssetClass, Prisma, Sleeve, TxType } from "@prisma/client";
import { signIn } from "@/auth";
import { accountsEnabled } from "@/lib/accounts";
import { plainExcerpt, slugify } from "@/lib/articles/text";
import { inviteDecision, roleChangeAllowed } from "@/lib/auth/permissions";
import { generateApiToken, tokenPepper } from "@/lib/auth/tokens";
import { SECTIONS, parseAssetClass, parseRole, parseSleeve } from "@/lib/domain";
import { parseDateInput } from "@/lib/format";
import { legsToLedger, parseTransactionCsv, planCsvImport } from "@/lib/csv/transactions";
import { deriveBook, type LedgerTx } from "@/lib/ledger/derive";
import { normalizeDraft, type DraftInput } from "@/lib/ledger/validate";
import { parseDecimal, toStorage } from "@/lib/money";
import { prisma } from "@/lib/db";
import { requireAction } from "@/server/guard";
import { loadInstruments, loadLedgerRows, toLedger } from "@/server/queries";

export type ActionState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
  token?: string;
};

function refresh() {
  revalidatePath("/", "layout");
}

function readable(error: unknown) {
  if (error instanceof Error && !("code" in error)) return error.message;
  return "That change could not be saved.";
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

async function writeAudit(
  db: Prisma.TransactionClient,
  event: {
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    summary: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  },
) {
  await db.auditEvent.create({ data: event });
}

function draftFromForm(formData: FormData): DraftInput {
  return {
    id: String(formData.get("id") ?? "") || undefined,
    occurredAt: String(formData.get("occurredAt") ?? ""),
    type: String(formData.get("type") ?? ""),
    symbol: String(formData.get("symbol") ?? ""),
    name: String(formData.get("name") ?? ""),
    assetClass: String(formData.get("assetClass") ?? ""),
    sleeve: String(formData.get("sleeve") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    price: String(formData.get("price") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    fee: String(formData.get("fee") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function txSnapshot(tx: {
  type: string;
  occurredAt: Date;
  quantity: string | null;
  price: string | null;
  amount: string | null;
  fee: string | null;
  notes: string | null;
  voidedAt: Date | null;
  instrument?: { symbol: string } | null;
}) {
  return {
    type: tx.type,
    occurredAt: tx.occurredAt.toISOString().slice(0, 10),
    symbol: tx.instrument?.symbol ?? null,
    quantity: tx.quantity,
    price: tx.price,
    amount: tx.amount,
    fee: tx.fee,
    notes: tx.notes,
    voidedAt: tx.voidedAt?.toISOString() ?? null,
  };
}

export async function saveTransaction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("edit_book");
  const input = draftFromForm(formData);
  const instruments = await loadInstruments();
  const normalized = normalizeDraft(
    input,
    instruments.map((instrument) => ({
      id: instrument.id,
      symbol: instrument.symbol,
      name: instrument.name,
      assetClass: instrument.assetClass,
      sleeve: instrument.sleeve,
    })),
  );
  if (!normalized.ok) return { fieldErrors: normalized.fieldErrors };

  const editingId = input.id ?? "";
  try {
    await prisma.$transaction(async (db) => {
      let instrumentId = normalized.value.tx.instrumentId;
      if (normalized.value.createInstrument) {
        try {
          const created = await db.instrument.create({
            data: { ...normalized.value.createInstrument, isExample: false },
          });
          instrumentId = created.id;
          await writeAudit(db, {
            actorId: user.id,
            actorEmail: user.email,
            action: "create",
            entityType: "instrument",
            entityId: created.id,
            summary: `Added ${created.symbol} to the book`,
            after: normalized.value.createInstrument,
          });
        } catch (error) {
          if (isUnique(error)) throw new Error("That symbol already exists. Reload and choose it from the list.");
          throw error;
        }
      }

      const rows = await db.transaction.findMany({
        where: { voidedAt: null },
        include: { instrument: { select: { symbol: true } } },
      });
      const prior = editingId ? rows.find((row) => row.id === editingId) : undefined;
      if (editingId && !prior) throw new Error("That transaction is no longer in the book.");
      const candidate: LedgerTx = {
        ...normalized.value.tx,
        id: editingId || "new",
        instrumentId,
        seq: prior ? prior.createdAt.getTime() : Date.now(),
      };
      const assessed = deriveBook([...rows.filter((row) => row.id !== editingId).map(toLedger), candidate]);
      if (!assessed.ok) throw new Error(assessed.error);

      const data = {
        occurredAt: parseDateInput(candidate.occurredAt) ?? new Date(),
        type: candidate.type as TxType,
        instrumentId,
        quantity: candidate.quantity ? toStorage(candidate.quantity) : null,
        price: candidate.price ? toStorage(candidate.price) : null,
        amount: candidate.amount ? toStorage(candidate.amount) : null,
        fee: toStorage(candidate.fee ?? "0"),
        notes: input.notes.trim() || null,
        updatedByEmail: user.email,
      };

      if (prior) {
        const updated = await db.transaction.update({
          where: { id: prior.id },
          data,
          include: { instrument: { select: { symbol: true } } },
        });
        await writeAudit(db, {
          actorId: user.id,
          actorEmail: user.email,
          action: "update",
          entityType: "transaction",
          entityId: prior.id,
          summary: `Edited ${prior.type.toLowerCase()} ${prior.instrument?.symbol ?? "cash"} on ${candidate.occurredAt}`,
          before: txSnapshot(prior),
          after: txSnapshot(updated),
        });
      } else {
        const created = await db.transaction.create({
          data: { ...data, createdByEmail: user.email, isExample: false },
          include: { instrument: { select: { symbol: true } } },
        });
        await writeAudit(db, {
          actorId: user.id,
          actorEmail: user.email,
          action: "create",
          entityType: "transaction",
          entityId: created.id,
          summary: `Entered ${created.type.toLowerCase()} ${created.instrument?.symbol ?? "cash"} on ${candidate.occurredAt}`,
          after: txSnapshot(created),
        });
      }
    });
  } catch (error) {
    return { formError: readable(error) };
  }

  refresh();
  redirect(editingId ? `/transactions/${editingId}/edit?saved=1` : "/transactions?saved=1");
}

export async function voidTransaction(formData: FormData) {
  const user = await requireAction("edit_book");
  const id = String(formData.get("id") ?? "");
  try {
    await prisma.$transaction(async (db) => {
      const prior = await db.transaction.findUnique({
        where: { id },
        include: { instrument: { select: { symbol: true } } },
      });
      if (!prior || prior.voidedAt) throw new Error("That transaction is already voided.");
      const rest = await db.transaction.findMany({
        where: { voidedAt: null, NOT: { id } },
        include: { instrument: { select: { symbol: true } } },
      });
      const assessed = deriveBook(rest.map(toLedger));
      if (!assessed.ok) throw new Error(assessed.error);
      const updated = await db.transaction.update({
        where: { id },
        data: { voidedAt: new Date(), voidedByEmail: user.email },
        include: { instrument: { select: { symbol: true } } },
      });
      await writeAudit(db, {
        actorId: user.id,
        actorEmail: user.email,
        action: "void",
        entityType: "transaction",
        entityId: id,
        summary: `Voided ${prior.type.toLowerCase()} ${prior.instrument?.symbol ?? "cash"} on ${prior.occurredAt.toISOString().slice(0, 10)}`,
        before: txSnapshot(prior),
        after: txSnapshot(updated),
      });
    });
  } catch (error) {
    redirect(`/transactions/${id}/edit?error=${encodeURIComponent(readable(error))}`);
  }
  refresh();
  redirect("/transactions?voided=1");
}

export async function updatePrice(formData: FormData) {
  const user = await requireAction("update_price");
  const symbol = String(formData.get("symbol") ?? "").toUpperCase();
  const instrument = await prisma.instrument.findUnique({ where: { symbol } });
  if (!instrument) redirect("/prices?error=That%20symbol%20is%20not%20in%20the%20book.");
  const clearing = formData.get("intent") === "clear";
  const parsed = parseDecimal(String(formData.get("price") ?? ""));
  if (!clearing && (!parsed || parsed.lte(0))) {
    redirect(`/prices?error=${encodeURIComponent(`Enter a price above zero for ${symbol}.`)}`);
  }
  const next = clearing ? null : toStorage(parsed ?? "0");
  await prisma.$transaction(async (db) => {
    await db.instrument.update({
      where: { id: instrument.id },
      data: { currentPrice: next, priceUpdatedAt: new Date(), priceUpdatedBy: user.email },
    });
    await writeAudit(db, {
      actorId: user.id,
      actorEmail: user.email,
      action: "price",
      entityType: "instrument",
      entityId: instrument.id,
      summary: next ? `Marked ${symbol} at ${next}` : `Cleared the mark for ${symbol}`,
      before: { price: instrument.currentPrice },
      after: { price: next },
    });
  });
  refresh();
  redirect(`/prices?saved=${symbol}`);
}

export async function updateInstrument(formData: FormData) {
  const user = await requireAction("edit_book");
  const symbol = String(formData.get("symbol") ?? "").toUpperCase();
  const instrument = await prisma.instrument.findUnique({ where: { symbol } });
  if (!instrument) redirect("/holdings");
  const name = String(formData.get("name") ?? "").trim();
  const assetClass = parseAssetClass(String(formData.get("assetClass") ?? ""));
  const sleeve = parseSleeve(String(formData.get("sleeve") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim();
  if (!name || name.length > 80 || !assetClass || !sleeve) {
    redirect(`/holdings/${symbol}?error=${encodeURIComponent("Name, asset class, and sleeve are required.")}`);
  }
  if (notes.length > 2000) {
    redirect(`/holdings/${symbol}?error=${encodeURIComponent("Notes must be 2000 characters or fewer.")}`);
  }
  await prisma.$transaction(async (db) => {
    await db.instrument.update({
      where: { id: instrument.id },
      data: { name, assetClass: assetClass as AssetClass, sleeve: sleeve as Sleeve, notes: notes || null },
    });
    await writeAudit(db, {
      actorId: user.id,
      actorEmail: user.email,
      action: "update",
      entityType: "instrument",
      entityId: instrument.id,
      summary: `Updated classification for ${symbol}`,
      before: { name: instrument.name, assetClass: instrument.assetClass, sleeve: instrument.sleeve, notes: instrument.notes },
      after: { name, assetClass, sleeve, notes: notes || null },
    });
  });
  refresh();
  redirect(`/holdings/${symbol}?saved=1`);
}

export async function deleteInstrument(formData: FormData) {
  const user = await requireAction("edit_book");
  const symbol = String(formData.get("symbol") ?? "").toUpperCase();
  const instrument = await prisma.instrument.findUnique({ where: { symbol } });
  if (!instrument) redirect("/holdings");
  const trades = await prisma.transaction.count({ where: { instrumentId: instrument.id } });
  if (trades > 0) {
    redirect(`/holdings/${symbol}?error=${encodeURIComponent("Void every trade in this symbol before deleting it.")}`);
  }
  await prisma.$transaction(async (db) => {
    await db.instrument.delete({ where: { id: instrument.id } });
    await writeAudit(db, {
      actorId: user.id,
      actorEmail: user.email,
      action: "delete",
      entityType: "instrument",
      entityId: instrument.id,
      summary: `Deleted unused symbol ${symbol}`,
      before: { symbol, name: instrument.name },
    });
  });
  refresh();
  redirect("/holdings?deleted=1");
}

export async function createSnapshot(formData: FormData) {
  const user = await requireAction("record_snapshot");
  const asOfRaw = String(formData.get("asOf") ?? "");
  const asOf = parseDateInput(asOfRaw);
  const aum = parseDecimal(String(formData.get("aum") ?? ""));
  const sharesRaw = String(formData.get("shares") ?? "").trim();
  const shares = sharesRaw ? parseDecimal(sharesRaw) : null;
  const note = String(formData.get("note") ?? "").trim();
  if (!asOf || asOfRaw > new Date().toISOString().slice(0, 10)) {
    redirect("/performance?error=Enter%20a%20date%20that%20is%20not%20in%20the%20future.");
  }
  if (!aum || aum.lt(0)) redirect("/performance?error=Enter%20an%20AUM%20of%20zero%20or%20more.");
  if (sharesRaw && (!shares || shares.lte(0))) redirect("/performance?error=Shares%20must%20be%20greater%20than%20zero.");
  if (note.length > 500) redirect("/performance?error=Note%20must%20be%20500%20characters%20or%20fewer.");
  const existing = await prisma.navSnapshot.findMany({ where: { voidedAt: null } });
  if (existing.some((snapshot) => snapshot.asOf.toISOString().slice(0, 10) === asOfRaw)) {
    redirect("/performance?error=A%20snapshot%20for%20that%20date%20already%20exists.%20Void%20it%20before%20adding%20another.");
  }
  const nav = shares ? toStorage(aum.div(shares)) : null;
  await prisma.$transaction(async (db) => {
    const created = await db.navSnapshot.create({
      data: {
        asOf,
        aum: toStorage(aum),
        sharesOutstanding: shares ? toStorage(shares) : null,
        navPerShare: nav,
        note: note || null,
        createdByEmail: user.email,
      },
    });
    await writeAudit(db, {
      actorId: user.id,
      actorEmail: user.email,
      action: "create",
      entityType: "snapshot",
      entityId: created.id,
      summary: `Recorded AUM snapshot for ${asOfRaw}`,
      after: { asOf: asOfRaw, aum: created.aum, sharesOutstanding: created.sharesOutstanding, navPerShare: created.navPerShare, note },
    });
  });
  refresh();
  redirect("/performance?saved=1");
}

export async function voidSnapshot(formData: FormData) {
  const user = await requireAction("record_snapshot");
  const id = String(formData.get("id") ?? "");
  const prior = await prisma.navSnapshot.findUnique({ where: { id } });
  if (!prior || prior.voidedAt) redirect("/performance?error=That%20snapshot%20is%20already%20voided.");
  await prisma.$transaction(async (db) => {
    await db.navSnapshot.update({ where: { id }, data: { voidedAt: new Date() } });
    await writeAudit(db, {
      actorId: user.id,
      actorEmail: user.email,
      action: "void",
      entityType: "snapshot",
      entityId: id,
      summary: `Voided AUM snapshot for ${prior.asOf.toISOString().slice(0, 10)}`,
      before: { aum: prior.aum, navPerShare: prior.navPerShare },
    });
  });
  refresh();
  redirect("/performance?voided=1");
}

export async function previewImport(csv: string) {
  await requireAction("import_csv");
  const [instruments, rows] = await Promise.all([loadInstruments(), loadLedgerRows()]);
  const refs = rows.flatMap((row) => (row.externalRef ? [row.externalRef] : []));
  return planCsvImport({
    csv,
    instruments,
    existing: rows.filter((row) => !row.voidedAt).map(toLedger),
    externalRefs: refs,
  });
}

export async function commitImport(csv: string): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const user = await requireAction("import_csv");
  try {
    const created = await prisma.$transaction(async (db) => {
      const instruments = await db.instrument.findMany();
      const rows = await db.transaction.findMany({ include: { instrument: { select: { symbol: true } } } });
      const plan = planCsvImport({
        csv,
        instruments,
        existing: rows.filter((row) => !row.voidedAt).map(toLedger),
        externalRefs: rows.flatMap((row) => (row.externalRef ? [row.externalRef] : [])),
      });
      if (plan.fileError) throw new Error(plan.fileError);
      if (plan.bookError) throw new Error(plan.bookError);
      if (plan.readyCount === 0) throw new Error("Nothing new to import.");

      const parsed = parseTransactionCsv(csv);
      const known = new Set(rows.flatMap((row) => (row.externalRef ? [row.externalRef] : [])));
      const ready = parsed.rows.flatMap((row) => {
        if (!row.leg || row.errors.length > 0) return [];
        if (row.leg.externalRef && known.has(row.leg.externalRef)) return [];
        return [{ line: row.line, leg: row.leg }];
      });
      const symbols = new Map(
        instruments.map((instrument) => [
          instrument.symbol,
          { id: instrument.id, assetClass: instrument.assetClass, sleeve: instrument.sleeve },
        ]),
      );
      const ledger = legsToLedger(ready, symbols);
      if (ledger.errors.length) throw new Error(ledger.errors.map((error) => error.message).join(" "));
      const idMap = new Map<string, string>();
      for (const [symbol, info] of symbols) {
        if (!info.id.startsWith("new:")) continue;
        const leg = ready.find((row) => row.leg.symbol === symbol)?.leg;
        if (!leg?.name) throw new Error(`${symbol} needs a name.`);
        const instrument = await db.instrument.create({
          data: {
            symbol,
            name: leg.name,
            assetClass: info.assetClass,
            sleeve: info.sleeve,
          },
        });
        idMap.set(info.id, instrument.id);
      }
      for (let index = 0; index < ledger.txs.length; index += 1) {
        const tx = ledger.txs[index];
        const leg = ready[index].leg;
        const instrumentId = tx.instrumentId?.startsWith("new:") ? idMap.get(tx.instrumentId) ?? null : tx.instrumentId;
        await db.transaction.create({
          data: {
            occurredAt: parseDateInput(tx.occurredAt) ?? new Date(),
            type: tx.type as TxType,
            instrumentId,
            quantity: tx.quantity ? toStorage(tx.quantity) : null,
            price: tx.price ? toStorage(tx.price) : null,
            amount: tx.amount ? toStorage(tx.amount) : null,
            fee: toStorage(tx.fee ?? "0"),
            notes: leg.notes,
            externalRef: leg.externalRef,
            createdByEmail: user.email,
          },
        });
      }
      await writeAudit(db, {
        actorId: user.id,
        actorEmail: user.email,
        action: "import",
        entityType: "transaction",
        summary: `Imported ${ledger.txs.length} transactions from CSV`,
        after: { count: ledger.txs.length, refs: ready.flatMap((row) => (row.leg.externalRef ? [row.leg.externalRef] : [])) },
      });
      return ledger.txs.length;
    });
    refresh();
    return { ok: true, created };
  } catch (error) {
    return { ok: false, error: readable(error) };
  }
}

async function uniqueSlug(type: ArticleType, title: string, ignoreId?: string) {
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (n < 50) {
    const existing = await prisma.article.findUnique({ where: { type_slug: { type, slug } } });
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
  return `${base}-${Date.now()}`;
}

export async function saveArticle(formData: FormData) {
  const intent = String(formData.get("intent") ?? "draft");
  const user = await requireAction(intent === "publish" ? "publish_article" : "write_article");
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "") as ArticleType;
  if (type !== "MARKET_REVIEW" && type !== "RESEARCH") redirect("/");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "");
  const excerptInput = String(formData.get("excerpt") ?? "").trim();
  const existing = id ? await prisma.article.findUnique({ where: { id } }) : null;
  if (id && (!existing || existing.type !== type)) redirect(SECTIONS[type].href);
  const back = existing ? `${SECTIONS[type].href}/${existing.slug}/edit` : `${SECTIONS[type].href}/new`;
  if (!title || title.length > 200) {
    redirect(`${back}?error=${encodeURIComponent("Title must be 1–200 characters.")}`);
  }
  if (!content.trim() || content.length > 100_000) {
    redirect(`${back}?error=${encodeURIComponent("Write the article in markdown before saving.")}`);
  }
  if (excerptInput.length > 500) {
    redirect(`${back}?error=${encodeURIComponent("Excerpt must be 500 characters or fewer.")}`);
  }
  const excerpt = excerptInput || plainExcerpt(content);
  const status = intent === "publish" ? "PUBLISHED" : "DRAFT";
  const slug = await uniqueSlug(type, title, existing?.id);
  const publishedAt = status === "PUBLISHED" ? existing?.publishedAt ?? new Date() : null;
  const saved = existing
    ? await prisma.article.update({
        where: { id },
        data: { title, slug, excerpt, content, status, publishedAt },
      })
    : await prisma.article.create({
        data: { type, title, slug, excerpt, content, status, publishedAt, authorId: user.id },
      });
  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action: existing ? "update" : "create",
      entityType: "article",
      entityId: saved.id,
      summary: `${status === "PUBLISHED" ? "Published" : "Saved draft"} in ${SECTIONS[type].title.toLowerCase()}: ${title}`,
      before: existing ? { title: existing.title, status: existing.status } : undefined,
      after: { title, status, slug },
    },
  });
  refresh();
  redirect(`${SECTIONS[type].href}/${saved.slug}`);
}

export async function deleteArticle(formData: FormData) {
  const user = await requireAction("write_article");
  const id = String(formData.get("id") ?? "");
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) redirect("/");
  await prisma.article.delete({ where: { id } });
  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action: "delete",
      entityType: "article",
      entityId: id,
      summary: `Deleted ${article.status === "DRAFT" ? "draft" : "article"}: ${article.title}`,
      before: { title: article.title, status: article.status, type: article.type },
    },
  });
  refresh();
  redirect(SECTIONS[article.type].href);
}

export async function inviteMember(formData: FormData) {
  if (!accountsEnabled()) redirect("/");
  const user = await requireAction("manage_team");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = parseRole(String(formData.get("role") ?? "VIEWER")) ?? "VIEWER";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/team?error=Enter%20a%20valid%20email.");
  if (name.length > 80) redirect("/team?error=Name%20must%20be%2080%20characters%20or%20fewer.");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.disabledAt) redirect("/team?error=That%20email%20is%20already%20on%20the%20invite%20list.");
  const saved = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { disabledAt: null, role, name: name || existing.name, isExample: false },
      })
    : await prisma.user.create({ data: { email, name: name || null, role } });
  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action: "invite",
      entityType: "user",
      entityId: saved.id,
      summary: `Invited ${email} as ${role.toLowerCase()}`,
      after: { email, role },
    },
  });
  refresh();
  redirect("/team?invited=1");
}

export async function changeRole(formData: FormData) {
  if (!accountsEnabled()) redirect("/");
  const actor = await requireAction("manage_team");
  const id = String(formData.get("id") ?? "");
  const next = parseRole(String(formData.get("role") ?? ""));
  if (!next) redirect("/team?error=Choose%20a%20role.");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.disabledAt) redirect("/team?error=That%20person%20is%20not%20active.");
  const adminCount = await prisma.user.count({ where: { role: "ADMIN", disabledAt: null } });
  const blocked = roleChangeAllowed({
    targetId: target.id,
    actorId: actor.id,
    targetIsAdmin: target.role === "ADMIN",
    nextIsAdmin: next === "ADMIN",
    adminCount,
    disabling: false,
  });
  if (blocked) redirect(`/team?error=${encodeURIComponent(blocked)}`);
  await prisma.user.update({ where: { id }, data: { role: next } });
  await prisma.auditEvent.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "role",
      entityType: "user",
      entityId: id,
      summary: `Changed ${target.email} from ${target.role.toLowerCase()} to ${next.toLowerCase()}`,
      before: { role: target.role },
      after: { role: next },
    },
  });
  refresh();
  redirect("/team?updated=1");
}

export async function revokeAccess(formData: FormData) {
  if (!accountsEnabled()) redirect("/");
  const actor = await requireAction("manage_team");
  const id = String(formData.get("id") ?? "");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.disabledAt) redirect("/team?error=That%20person%20is%20already%20revoked.");
  const adminCount = await prisma.user.count({ where: { role: "ADMIN", disabledAt: null } });
  const blocked = roleChangeAllowed({
    targetId: target.id,
    actorId: actor.id,
    targetIsAdmin: target.role === "ADMIN",
    nextIsAdmin: false,
    adminCount,
    disabling: true,
  });
  if (blocked) redirect(`/team?error=${encodeURIComponent(blocked)}`);
  await prisma.$transaction(async (db) => {
    await db.user.update({ where: { id }, data: { disabledAt: new Date() } });
    await db.session.deleteMany({ where: { userId: id } });
    await writeAudit(db, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "revoke",
      entityType: "user",
      entityId: id,
      summary: `Revoked access for ${target.email}`,
    });
  });
  refresh();
  redirect("/team?revoked=1");
}

export async function createToken(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("manage_tokens");
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 80) return { formError: "Name the token in 80 characters or fewer." };
  const issued = generateApiToken(tokenPepper());
  await prisma.apiToken.create({
    data: { name, tokenHash: issued.hash, tokenPrefix: issued.prefix, createdById: user.id },
  });
  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action: "create",
      entityType: "api_token",
      summary: `Created API token ${name}`,
      after: { prefix: issued.prefix },
    },
  });
  refresh();
  return { token: issued.plaintext };
}

export async function revokeToken(formData: FormData) {
  const user = await requireAction("manage_tokens");
  const id = String(formData.get("id") ?? "");
  const token = await prisma.apiToken.findUnique({ where: { id } });
  if (!token || token.revokedAt) redirect("/tokens?error=That%20token%20is%20already%20revoked.");
  await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action: "revoke",
      entityType: "api_token",
      entityId: id,
      summary: `Revoked API token ${token.name}`,
    },
  });
  refresh();
  redirect("/tokens?revoked=1");
}

export async function requestMagicLink(formData: FormData) {
  if (!accountsEnabled()) redirect("/login");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const directory = await prisma.user.findMany({ select: { email: true, disabledAt: true } });
  const decision = inviteDecision(
    email,
    directory.map((entry) => ({ email: entry.email, disabled: Boolean(entry.disabledAt) })),
  );
  if (!decision.allowed) {
    const code = decision.reason === "invalid" ? "invalid" : decision.reason === "disabled" ? "revoked" : "uninvited";
    redirect(`/login?error=${code}`);
  }
  try {
    const result = await signIn("nodemailer", { email, redirect: false, redirectTo: "/" });
    if (typeof result === "string" && result.includes("error=")) {
      redirect("/login?error=send");
    }
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error(error);
    redirect("/login?error=send");
  }
  redirect(`/login/check-email?email=${encodeURIComponent(email)}`);
}
