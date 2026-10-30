# Partnership desk

Private web desk for a small fund. The book is manual: a transaction log derives positions and average cost, prices are marks you type in, and performance is a log of AUM snapshots. Weekly market reviews and weekly research articles share one editor. Access is invite-only.

The fund name is a placeholder until you set `FUND_NAME`. Every figure in the example seed is illustrative.

## What you can do

- Sign in with a magic link. Only emails an admin has invited are accepted. There is no public sign-up.
- Roles are admin, editor, and viewer. New invites default to viewer. An admin can choose editor or admin at invite time, and can change roles later.
- Editors can add and edit holdings, import CSV, update prices, record snapshots, and write or publish both article sections. They cannot manage people or API tokens.
- Viewers can read the book and published articles. Drafts stay hidden.
- Admins can do all of that, plus invites, roles, and API tokens.

## Stack

Next.js, Prisma with Postgres, Auth.js magic links, and Tailwind. Local development uses the Postgres service in `docker-compose.yml`. Production runs on Vercel with Neon (or Vercel’s Neon integration) and Resend. See [DEPLOY.md](DEPLOY.md).

## Local setup

```bash
cp .env.example .env
# Set AUTH_SECRET (openssl rand -base64 32) and ADMIN_EMAIL.
docker compose up -d --wait
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm run db:setup` does the Docker start, migrate, and seed in one step.

The desk listens on [http://127.0.0.1:4321](http://127.0.0.1:4321).

With `EMAIL_PROVIDER=console`, the sign-in link is printed in the server log and, in development, on the check-email page. The seed invites:

| Email | Role |
| --- | --- |
| `ADMIN_EMAIL` | Admin |
| `editor@example.com` | Editor (example) |
| `viewer@example.com` | Viewer (example) |

No passwords are stored. Set `SEED_EXAMPLE_DATA=false` before seeding if you want an empty book with only the admin.

## Book

Positions are not typed in directly. You enter trades, and the desk replays them.

| Type | Effect |
| --- | --- |
| Buy | Increases quantity. Cost basis increases by quantity × price, plus the cash fee. Cash falls by the same amount. |
| Sell | Decreases quantity at average cost. The fee reduces proceeds. A sale the book cannot cover is refused. |
| Deposit | Cash in, or an in-kind contribution. In-kind price is the cost per unit. |
| Withdrawal | Cash out, or an in-kind distribution relieved at average cost. |
| Fee | Cash expense, or units leaving a position at average cost. |
| Yield | Cash income, or units received. Leave the yield price empty to carry the units at zero cost. |

Dates are stored as UTC calendar dates. Edits and voids replay the whole log. If the result would take a position negative, the change is refused and the previous book is kept. Voids stay in the audit trail.

Prices are manual. `src/lib/prices/fetcher.ts` is the hook for a later price source. Nothing is fetched in this version.

Snapshots are entered on Performance. “Use current book value” fills AUM from the derived book. You can change the number before saving. NAV per share is AUM divided by shares when you enter shares.

### CSV

The template is [`public/templates/transactions.csv`](public/templates/transactions.csv). The import page lists every column. Invalid rows block the file. An `external_ref` that is already stored is skipped, so the sample file can be imported twice without duplicating those rows.

```text
occurred_at,type,symbol,name,asset_class,sleeve,quantity,price,amount,fee,notes,external_ref
```

`asset_class` is `crypto`, `stock`, `thematic_basket`, or `defi_yield`. `sleeve` is `crypto`, `stocks`, `thematic`, `defi_yield`, or `arbitrage`. Sleeves and asset classes are independent: a crypto instrument can sit in the arbitrage sleeve.

## Integrations

Venue sync is not built. The Integrations page shows Hyperliquid, Lighter, and Interactive Brokers as disabled “coming soon” cards. `src/lib/sources/registry.ts` exports an empty `syncAdapters` map and a `SyncAdapter` interface. A later read-only adapter would register there and still land in this same ledger. This version reads no venue credentials and has no environment variables for them.

## Articles

Market review (`/reviews`) and research (`/research`) are one model with a section field. Admins and editors draft in markdown and publish. Viewers only receive published articles. Saving a draft of a published article unpublishes it.

Agents create drafts with a bearer token an admin issues under API tokens. The plaintext is shown once. The database stores a SHA-256 of `AUTH_SECRET` plus the token.

```http
POST /api/v1/articles
Authorization: Bearer fdk_...
Content-Type: application/json

{
  "type": "market_review",
  "title": "Week of 27 Oct",
  "excerpt": "Optional",
  "content": "# Note\n\nMarkdown body."
}
```

`type` may also be `research`. The response is always `status: "draft"`. Sending `"status": "published"` is rejected. Rotate `AUTH_SECRET` and every token stops working.

## Tests

```bash
npm test
```

The tests cover the role matrix, the invite gate (unknown and revoked emails are refused), average-cost derivation, the sample CSV, and the agent draft endpoint (missing, revoked, and publish attempts fail; a valid token creates a draft).

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Postgres URL. Locally this is the Docker database. On Vercel it is the Neon pooler URL. |
| `DATABASE_URL_UNPOOLED` | Yes | Direct Postgres URL for Prisma Migrate. Locally it can match `DATABASE_URL`. |
| `AUTH_SECRET` | Yes | Auth.js session secret and API token pepper. `openssl rand -base64 32`. |
| `AUTH_URL` | Yes | Public origin used in magic links, such as `https://desk.example.com`. |
| `AUTH_TRUST_HOST` | Deploy | Set `true` behind a proxy. |
| `ADMIN_EMAIL` | Yes for seed | First admin. No password. |
| `ADMIN_NAME` | No | Display name for that admin. |
| `FUND_NAME` | No | Shown in the desk. Defaults to `[Fund Name]`. |
| `EMAIL_PROVIDER` | No | `console` (default), `resend`, or `smtp`. |
| `EMAIL_FROM` | Yes for real mail | From address. |
| `RESEND_API_KEY` | With Resend | Resend API key. |
| `SMTP_HOST` | With SMTP | SMTP host. |
| `SMTP_PORT` | No | Default `587`. Port `465` uses TLS. |
| `SMTP_USER` | No | SMTP username. |
| `SMTP_PASSWORD` | No | SMTP password. |
| `SEED_EXAMPLE_DATA` | No | Unset locally loads the illustrative book. `false` on Vercel seeds only the admin. |

Do not commit `.env`. `.env.example` contains placeholders only.

## Deploy

Production is Vercel, deployed from Origin, with Neon Postgres and Resend. The ordered steps, including every environment variable, are in [DEPLOY.md](DEPLOY.md). Do not mirror this repo to GitHub.

`npm run build` generates the Prisma client, applies migrations, seeds, and builds Next.js. On Vercel, `SEED_EXAMPLE_DATA=false` makes that seed create only the `ADMIN_EMAIL` admin.

## Roles, again

The owner stays admin by being the `ADMIN_EMAIL` user. Invite the editor from Team and choose Editor in the role field. That person can maintain the book and both article sections, and cannot open Team or API tokens.
