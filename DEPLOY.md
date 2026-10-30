# Deploy the desk on Vercel

Deploy from this Origin repository. Do not mirror the project to GitHub, and do not import it as a GitHub repository. Vercel connects to Origin directly.

Origin repositories are private. Vercel only deploys them from a **Pro or Enterprise** team. A Hobby team cannot deploy this repo.

The production database is Postgres (Neon, including Neon created from the Vercel dashboard). Local development stays on Postgres too, usually the Docker database in `docker-compose.yml`. The Vercel build runs `prisma generate`, `prisma migrate deploy`, `prisma db seed`, and `next build`. With `SEED_EXAMPLE_DATA=false`, that seed creates only the admin from `ADMIN_EMAIL`. It does not load the example book, editor, or viewer.

No passwords are stored. Sign-in is a Resend magic link.

## 1. Use a Vercel Pro or Enterprise team

Open the Vercel dashboard and select the team that will own the project. If the team is on Hobby, upgrade it before continuing. Origin deploys are rejected on Hobby.

## 2. Create the Resend account and verify a sender domain

Magic links in production are sent by Resend. The address in `EMAIL_FROM` must be on a domain you control and have verified. Resend’s `onboarding@resend.dev` sandbox only delivers to your own Resend login, so the editor would never receive a link.

1. Create an account at [resend.com](https://resend.com).
2. Open **Domains** and add the domain you will send from, such as `yourfund.com`.
3. At the DNS host for that domain, add every record Resend shows (SPF and DKIM, and any other record on that page). Copy the host and value exactly.
4. In Resend, wait until the domain status is **Verified**.
5. Open **API Keys**, create a key with permission to send email, and copy it once. You will paste it into Vercel as `RESEND_API_KEY`. Do not commit it.
6. Choose the from-address you will use, for example `Fund Desk <desk@yourfund.com>`. The domain must be the verified one.

## 3. Create the Postgres database

Use one of these. You need two connection strings:

- **Pooled** (`DATABASE_URL`), hostname contains `-pooler`. The running app uses this.
- **Direct** (`DATABASE_URL_UNPOOLED`), hostname does not contain `-pooler`. Prisma Migrate uses this.

### Neon from the Neon console

1. Create a project at [neon.tech](https://neon.tech).
2. Open **Connect** and copy the **pooled** connection string and the **direct** connection string. Both should include `sslmode=require`.
3. On the pooled string only, if `pgbouncer=true` is missing, append it:  
   `...sslmode=require&pgbouncer=true`  
   Leave the direct string without `pgbouncer`.

You will paste both strings into Vercel in the next step. Do not put them in the repo.

### Neon from the Vercel dashboard

You can instead attach Neon after the Vercel project exists:

1. In the Vercel project, open **Storage** and create or connect a **Neon** database.
2. Connect it to this project for **Production** and **Preview**.
3. Leave preview branching off for the first deploy so there is one database to sign in to.
4. The integration injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct). Confirm both exist under **Settings → Environment Variables**.
5. If `DATABASE_URL` has no `pgbouncer=true`, edit that variable and append `&pgbouncer=true`. Do not add that flag to `DATABASE_URL_UNPOOLED`.

If the project was created before the database was connected, redeploy after the variables exist. The first build has to see them.

## 4. Import the Origin repo and set every environment variable

1. In Vercel, choose **Add New… → Project**.
2. Choose **Continue with Origin**. If Origin is not listed, connect the Origin team from that screen. Do not choose GitHub.
3. Select this repository. The framework preset is **Next.js**. The root directory is the repository root. Leave the production branch as `main`.
4. Do not override the build command. `vercel.json` already runs:

   ```bash
   prisma generate && prisma migrate deploy && prisma db seed && next build
   ```

5. Before the first deploy, add these variables for **Production** and **Preview**. Values below are the names and what to put in them, not real secrets.

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Pooled Neon URL, with `sslmode=require` and `pgbouncer=true`. Skip this row if the Neon integration already created it, then only append `pgbouncer=true` if it is missing. |
| `DATABASE_URL_UNPOOLED` | Direct Neon URL, with `sslmode=require` and without `pgbouncer`. Skip this row if the integration already created it. |
| `AUTH_SECRET` | A long random string from `openssl rand -base64 32`. At least 16 characters. |
| `AUTH_URL` | The production origin you will use, such as `https://your-project.vercel.app`. No trailing slash. Match the project name you are about to create, or your custom domain. |
| `AUTH_TRUST_HOST` | `true` |
| `ADMIN_EMAIL` | Your real email. The seed invites this address as admin. No password. |
| `ADMIN_NAME` | Your name, shown in the desk. Optional. |
| `FUND_NAME` | The fund name to show in the sidebar. Use `[Fund Name]` until you decide. |
| `EMAIL_PROVIDER` | `resend` |
| `EMAIL_FROM` | The verified sender, for example `Fund Desk <desk@yourfund.com>`. |
| `RESEND_API_KEY` | The Resend API key from step 2. |
| `SEED_EXAMPLE_DATA` | `false` |

Do not set `SEED_EXAMPLE_DATA` to `true` on Vercel. An unset value also stays empty on Vercel, but set `false` so the intent is visible. The seed then upserts `ADMIN_EMAIL` as admin and stops. It does not create `editor@example.com` or the sample book.

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD` are unused when `EMAIL_PROVIDER=resend`. Leave them unset.

## 5. Deploy

Click **Deploy**. The build applies the Postgres migration and seeds the admin.

If the build fails because the database variables were missing, connect Neon, confirm the variables, then open **Deployments** and redeploy with the build cache turned off.

If the migration fails on `CREATE SCHEMA "public"`, the Neon role cannot create schemas. Delete that one statement from a follow-up only if Neon support tells you to. The generated migration uses `IF NOT EXISTS`, which succeeds on a normal Neon database.

When the deployment is ready, open the production URL. If you then attach a custom domain, change `AUTH_URL` to that origin and redeploy so magic links use the domain you actually open.

## 6. Sign in as admin

1. Open the production URL from the deployment.
2. Enter `ADMIN_EMAIL` and request a link.
3. Open the message from Resend and follow the link. It expires in 24 hours.
4. You should land on an empty overview: no example banner, no sample positions, and no sample articles.

If the message never arrives, check that the domain is verified, `EMAIL_FROM` uses that domain, `RESEND_API_KEY` is set, and `AUTH_URL` is the site you opened. Then request a new link.

## 7. Invite the editor

1. While signed in as the admin, open **Team**.
2. Enter the editor’s email.
3. Set **Role** to **Editor**. New invites default to viewer, so change it before sending.
4. Click **Invite**.
5. The editor opens the same production URL, enters that email, and uses the Resend link.

The editor can add trades, import CSV, update prices, record snapshots, and draft or publish market reviews and research. They cannot open Team or API tokens, and they cannot change roles.

## What each later deploy does

A push to `main` deploys production. Vercel runs migrations against the direct URL, then the seed. The seed keeps `ADMIN_EMAIL` as an active admin and does not replace a book you have entered. Preview deployments run the same build. Keep `SEED_EXAMPLE_DATA=false` on Preview as well.

## Local development

This is not required to deploy.

```bash
cp .env.example .env
docker compose up -d --wait
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm run db:setup` starts Postgres, migrates, and seeds. With `SEED_EXAMPLE_DATA=true` (the local example default when the variable is unset and you are not on Vercel), the seed loads the illustrative book. Set it to `false` for an empty local desk. The Docker user and password `desk` exist only for that local database.
