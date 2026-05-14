# MLG Manager's Meal Monitoring

Internal cashier-facing web app for logging MLG Hospitality managers' meal credit usage,
with server-side enforcement that prevents charging over each manager's monthly limit.
Replaces 52 individual Lark Base forms (one per manager) with one unified app.

**Stack:** Next.js 15 · React 19 · TypeScript · Lark Base (Bitable) as the database · Vercel hosting.

## How it works

1. Each manager has a printed QR card. Scanning opens `/m/{lark_record_id}`.
2. The cashier sees the manager's name and **Available Balance** (Credit − this month's spending).
3. Cashier fills Branch, OR Number, Spent Value → submits.
4. Server re-validates Spent ≤ Available, then writes a row to the Lark Base `Transaction History` table.
5. Lark Base's existing rollup on `Master Records.Current Month Spending` updates automatically — no app-side bookkeeping.

Monthly resets on the 1st come for free: the rollup filters by `Month Number = current`, so a
new calendar month starts at zero spending without any cron.

## Layout

```
src/
  app/
    layout.tsx                  Root layout, MLG palette
    page.tsx                    Landing
    m/[recordId]/page.tsx       Cashier form (server component)
    m/[recordId]/MealForm.tsx   Client form + client-side guard
    m/[recordId]/not-found.tsx  Unknown manager
    api/transactions/route.ts   POST: server-side enforcement + Lark write
  lib/
    lark.ts                     Lark Bitable client + token cache
    format.ts                   ₱ formatter, Manila TZ date helpers
scripts/
  inspect_lark_base.py          List tables and fields
  inspect_records.py            Dump sample rows
  add_manager_link.py           Idempotent: add Manager Link field
  backfill_manager_link.py      Populate Manager link on historical rows
  generate_qrs.py               Generate one plain QR PNG per manager
  generate_branded_qrs.py       Generate branded MLG QR card per manager
  list_test_links.py            Print all 52 manager test URLs
  fix_month_formula.py          One-shot fix for the Transaction History Month formula
  cleanup_branch_options.py     Rename Manilay Bay typo, report duplicates
```

## Setup

1. `cp .env.local.example .env.local` and fill in:
   - `LARK_APP_ID` / `LARK_APP_SECRET` — from the Lark Developer Console
   - `LARK_BASE_ID` — from your Lark Base URL (`.../base/{base_id}?...`)
   - `LARK_MANAGERS_TABLE_ID` — Master Records table (currently `tblhhsgGkvjFqVzM`)
   - `LARK_TRANSACTIONS_TABLE_ID` — Transaction History (currently `tblVkJV8f3RCY8xi`)
   - `APP_BASE_URL` — e.g. `http://localhost:3000` for dev
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:3000/m/<some-record-id>` — get IDs from `python scripts/list_test_links.py`.

## Generating QR codes

```
python scripts/generate_qrs.py https://your-app.vercel.app
```

Output lands in `qr/` (gitignored). One PNG per manager + an `_index.csv` lookup.

## Lark Base schema

- **Master Records** (`tblhhsgGkvjFqVzM`): Name, Position, Credit, Current Month Spending (rollup), Remaining Credit (formula), Month Number (formula).
- **Transaction History** (`tblVkJV8f3RCY8xi`): Transaction ID, Name, Spent Value, Date, OR Number, Month Number (formula), Branch, Manager (link → Master Records).
- 52 per-manager tables exist from the legacy form-per-manager flow and are kept as historical archive — the app does **not** write to them.

## Deployment

Vercel: connect this repo, set the four `LARK_*` env vars + `APP_BASE_URL` to the production URL,
deploy. No build steps beyond Next.js defaults.

## Operational notes

- The Lark `tenant_access_token` is cached per-lambda for its 7200s TTL.
- Server validation is authoritative: client UI is convenience, not security.
- Managers with `Position` containing "Resigned" are blocked at the server with HTTP 403.
- Currency formatted as `en-PH`, dates rendered in `Asia/Manila`.
- The `Month` formula on Transaction History returns "Invalid Month" — not used by the app
  (we depend on `Month Number` instead). Fix when convenient.
