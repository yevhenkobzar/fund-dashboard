# Deploy the desk on Vercel Hobby

Deploy from GitHub. Import `yevhenkobzar/fund-dashboard` in a Vercel Hobby team. A Hobby plan is enough.

The production database is Postgres on Neon. Local development uses the Postgres service in `docker-compose.yml`. The build in `vercel.json` runs:

```bash
prisma generate && prisma migrate deploy && prisma db seed && next build
```

Leave that build command as it is.

Sign-in for v1 is one shared access code from `SITE_ACCESS_CODE`. The unlocked session is the owner admin from `ADMIN_EMAIL` (`kobzar.z05@gmail.com`). That person is the only editor. There is no magic-link email and no Resend account. Per-user accounts, roles, and invites remain in the code behind `ACCOUNTS_ENABLED=false`.

Do not commit `.env` or put the real access code in the repository.

## 1. Create the Neon database

You need two connection strings:

- **Pooled** (`DATABASE_URL`). The hostname contains `-pooler`. The running app uses this.
- **Direct** (`DATABASE_URL_UNPOOLED`). The hostname does not contain `-pooler`. Prisma Migrate uses this.

1. Create a project at [neon.tech](https://neon.tech), or from the Vercel project open **Storage** and connect **Neon**.
2. Copy the pooled string and the direct string. Both should include `sslmode=require`.
3. On the pooled string only, append `&pgbouncer=true` if that flag is missing. Leave the direct string without `pgbouncer`.

If you connect Neon from the Vercel project after it exists, the integration can inject `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Confirm both are present, add `pgbouncer=true` to the pooled URL only, then redeploy.

## 2. Import the GitHub repository

1. In Vercel, choose **Add New… → Project**.
2. Under GitHub, import `yevhenkobzar/fund-dashboard`. The repository should be private.
3. Framework preset: **Next.js**. Root directory: the repository root. Production branch: `main`.
4. Do not change the build command. `vercel.json` already migrates, seeds, and builds.

## 3. Set the environment variables

Add these for **Production** and **Preview** before the first successful deploy. The values here are names and placeholders, not real secrets.

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Pooled Neon URL with `sslmode=require` and `pgbouncer=true`. Skip if Neon already created it, then only add the flag if it is missing. |
| `DATABASE_URL_UNPOOLED` | Direct Neon URL with `sslmode=require` and without `pgbouncer`. Skip if Neon already created it. |
| `AUTH_SECRET` | `openssl rand -base64 32`. At least 16 characters. This signs the session cookie and API tokens. |
| `SITE_ACCESS_CODE` | `openssl rand -base64 24`. The shared code for the gate. Do not commit it. |
| `AUTH_URL` | `https://your-project.vercel.app` with no trailing slash. Change it if you add a custom domain, then redeploy. |
| `AUTH_TRUST_HOST` | `true` |
| `ADMIN_EMAIL` | `kobzar.z05@gmail.com` |
| `ADMIN_NAME` | Your name. Optional. |
| `FUND_NAME` | The name in the sidebar, or `[Fund Name]`. |
| `ACCOUNTS_ENABLED` | `false` |
| `SEED_EXAMPLE_DATA` | `false` |

Leave `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, and the `SMTP_*` variables unset. They are only used if you later set `ACCOUNTS_ENABLED=true`.

`SEED_EXAMPLE_DATA=false` makes the build seed create only `kobzar.z05@gmail.com` as admin. It does not load the example book.

## 4. Deploy

Click **Deploy**. The build applies the Postgres migration and seeds the admin.

If the first build ran before the database variables existed, connect Neon, confirm the variables, then redeploy with the build cache off.

Open the production URL when the deployment is ready.

## 5. Sign in

1. Open the production site.
2. Enter `SITE_ACCESS_CODE`.
3. The session cookie is httpOnly and signed with `AUTH_SECRET`. It lasts 14 days. This session is the owner: it can edit the book, publish both article sections, and manage API tokens.
4. The overview is empty until you enter trades. There is no example banner.

Five wrong codes from the same address pause further attempts for about ten minutes. The limit is per server instance, which is enough to slow guessing.

API tokens stay under **API tokens**. Create one there if an agent should draft articles. The token is shown once and stored only as a hash.

Team invites stay off while `ACCOUNTS_ENABLED` is false. Turn that flag on later, set an email provider, and redeploy when you want separate editor and viewer accounts again.

## Local development

```bash
cp .env.example .env
# Set AUTH_SECRET, SITE_ACCESS_CODE, and leave ACCOUNTS_ENABLED=false.
docker compose up -d --wait
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm run db:setup` starts Postgres, migrates, and seeds. With `SEED_EXAMPLE_DATA` unset outside Vercel, the local seed still loads the illustrative book plus the admin from `ADMIN_EMAIL`.
