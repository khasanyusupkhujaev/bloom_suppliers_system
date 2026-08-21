# BLOOM Supplier Portal

Full local platform for the BLOOM Supplier Portal MVP.

## Run

```bash
npm start
```

Open `http://127.0.0.1:4173/`.

## Supabase

This app uses `data/db.json` locally when `DATABASE_URL` is not set. In production, set `DATABASE_URL` to the Supabase Postgres transaction pooler connection string.

Project details:

- Supabase project ref: `czyzehhdpgvowkzkwlqc`
- Region: `ap-southeast-2`

Initialize Supabase after setting `DATABASE_URL`:

```bash
npm run db:init
```

The current MVP schema stores app data in the `app_state` JSONB table. The SQL is in `supabase/schema.sql`.

## Vercel

Configured for Vercel with `vercel.json`.

Project:

- GitHub repo: `https://github.com/khasanyusupkhujaev/bloom_suppliers_system.git`
- Vercel project name: `Bloom_suppliers_system`
- Domain: `cde.bloom.vercel.com`

Required Vercel environment variables:

```text
DATABASE_URL=postgresql://postgres.czyzehhdpgvowkzkwlqc:<PASSWORD>@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
PGSSLMODE=require
```

After environment variables are set, deploy from GitHub or with Vercel CLI.

## Demo Accounts

All demo accounts use password `password123`.

- Supplier: `sales@aurora.example`
- Manager / assigner: `manager@bloom.test`
- Category Manager 1: `cm1@bloom.test`
- Category Manager 2: `cm2@bloom.test`
- Commercial Director: `director@bloom.test`
- Admin: `admin@bloom.test`

## What Works

- Supplier registration, login, logout, secure password hashing, and session cookies.
- Duplicate supplier TIN / INN blocking during registration and profile updates.
- Role-based API permissions for supplier, manager, CM, director, and admin.
- Supplier profile maintenance.
- New assortment proposal creation with multiple SKUs.
- Required SKU commercial fields, photo URL fields, and repeatable competitor prices.
- Manager assignment and category-to-CM mapping.
- CM-level SKU review: select, reject, or keep under review.
- Duplicate EAN warning from stored portal proposal data.
- Sending only selected SKUs to Commercial Director approval.
- Director final approval or rejection per SKU.
- Approved product creation when the director approves an SKU.
- Proposal search/filtering, SKU counters, notification log, and RU/EN interface labels.
- Disk persistence in `data/db.json`.

## Verification

```bash
node --check server.js
node --check public/app.js
node scripts/smoke-test.mjs
```

The smoke test covers: supplier login -> multi-SKU proposal creation -> CM review -> director approval -> approved product creation.
