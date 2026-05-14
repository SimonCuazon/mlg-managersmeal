# Single Source of Truth — MLG Manager's Meal Monitoring

Everything load-bearing about this system in one document. If a decision, ID, formula,
or rule is described here, this file is authoritative. If two pieces of code or documentation
disagree, defer to this document and fix the drift.

Last reviewed: 2026-05-12.

---

## 1. Purpose

**Why this exists.** Each MLG Hospitality manager has a monthly meal credit. Until this
project, the workflow was:

- 52 individual Lark Base forms (one per manager) embedded in their printed QR card.
- Cashiers scanned the QR, opened that manager's form, filled in Branch / OR Number /
  Spent Value, and submitted. The form wrote a row into that manager's dedicated table.
- Lark Base rolled per-manager-table rows into `Master Records.Current Month Spending`
  and `Remaining Credit` for visibility.

**What was missing.** Nothing prevented a cashier from charging *more* than the manager's
remaining credit. The forms were dumb; enforcement only existed in policy, not in the
system.

**What this project adds.**

1. One Next.js web app replaces 52 Lark forms — one URL pattern, `/m/{record_id}`, one codebase.
2. **Server-side enforcement**: a submission with `Spent Value > Available Balance` is rejected
   before the row is written.
3. UI hides the credit limit (confidential) and shows only the **Available Balance**.
4. Lark Base remains the system of record. The app reads and writes through the Bitable API.

---

## 2. Architecture

```
                                            ┌──────────────────────┐
  Cashier phone / tablet                    │  Lark Base           │
  ┌────────────┐  scan QR    ┌───────────┐  │  (system of record)  │
  │ Camera     ├────────────▶│ Browser   │  │                      │
  └────────────┘   /m/<id>   └─────┬─────┘  │  Master Records      │
                                   │ HTTPS  │  Transaction History │
                                   ▼        │                      │
                          ┌─────────────────┴──────────────┐       │
                          │  Next.js on Vercel             │       │
                          │  - /m/[recordId] page          │       │
                          │  - /api/transactions POST      │       │
                          │  - Lark client (token cache)   │◀──────┤
                          └─────────────────┬──────────────┘       │
                                            │ Bitable v1 API       │
                                            └──────────────────────┘
```

**Reads** (every page load of `/m/{record_id}`):

1. `GET Master Records / records / {record_id}` → Name, Position, Credit.
2. `POST Transaction History / records / search` filtered by `Manager = record_id`
   AND `Month Number = current` → sum `Spent Value`.
3. `GET Transaction History / fields` → Branch SingleSelect options.
4. Compute `Available Balance = max(0, Credit − sum)`.

**Writes** (one per cashier submission):

1. Re-do the read pipeline (server cannot trust the client's claimed available balance).
2. Validate `Spent ≤ Available`, manager not resigned, branch valid.
3. `POST Transaction History / records` with Name, Branch, OR Number, Spent Value, Date,
   Manager link, Transaction ID.
4. Lark's existing rollup on `Master Records.Current Month Spending` reflects the new row
   automatically — no app-side bookkeeping needed.

---

## 3. Lark Base — the technical reference

**Base:** `DmiYbZsDha8RcWstSjNuh3tRsid`
**Host:** `https://open.larksuite.com` (Lark Suite, not Feishu — the workspace lives on
`mlghospitality.sg.larksuite.com`).

### 3.1 Master Records (`tblhhsgGkvjFqVzM`)

The manager roster. 52 active records.

| Field | ID | Type | Notes |
|---|---|---|---|
| Name | `fldMDNP9Cg` | Text | Manager's full name. |
| Position | `fldLnExxY6` | Text | Job title. Contains `"Resigned"` for inactive managers — server blocks them. |
| Credit | `fldR3vQnlB` | Number | Monthly limit in PHP. **Confidential** — never shown in UI. ₱999,999 is the "effectively unlimited" sentinel used for owners. |
| Current Month Spending | `fldcHcykIc` | Lookup (rollup) | Sum of `Transaction History.Spent Value` where Name+Month Number match. Auto-updates. |
| Remaining Credit | `fld1Y1ZvwX` | Formula | `Credit − Current Month Spending`. |
| Month Number | `fldIwl1FgX` | Formula | `CONCATENATE(MONTH(TODAY()), YEAR(TODAY()))` → e.g. `"52026"` in May 2026. Powers the monthly reset. |

### 3.2 Transaction History (`tblVkJV8f3RCY8xi`)

The flat transaction log. The app writes here.

| Field | ID | Type | Written by app? |
|---|---|---|---|
| Transaction ID | `fldRusaCgr` | Text | Yes — format `YYMM-{6 hex}` (e.g. `2605-2875a8`), globally unique. |
| Name | `fldciyrpG5` | Text | Yes — copied from Master Records. Used by the existing rollup formula. |
| Spent Value | `fld1MkwveV` | Number | Yes — peso amount. |
| Date | `fldZxGm9RU` | DateTime | Yes — server-side `Date.now()` (ms epoch). |
| OR Number | `fldzHRSvxl` | Text | Yes — from cashier input. |
| Month Number | `fldekE0CIZ` | Formula | No — computed from Date. |
| Month | `flddbdPSVO` | Formula | No — **broken**, returns `"Invalid Month"`. App ignores it. |
| Branch | `fldJ7sykaC` | SingleSelect | Yes — must match a Lark option. App fetches options dynamically. |
| Manager | `fldNPRrmLA` | SingleLink → Master Records | Yes — populated via array of record_ids. Added by us 2026-05-12 and backfilled on all 723 historical rows. |

### 3.3 Legacy per-manager tables (52 of them)

Frozen historical archive. The app does **not** write to these. Pattern: one table per
manager, named exactly after the manager. Schema is uniform across all 52 (Transaction ID,
Name, Branch, Remaining Credit, Spent Value, Date, OR Number, Month Number). Two outliers:

- `Roland Malagayo` table has extra `Location` and `Location 2` fields.
- `Ezekiel Guevarra` has `OR Number` as Number (not Text). Cosmetic only.

### 3.4 Other tables

- `Transaction History` (covered above).
- `Table` (`tblFgFeXsFYdfKQS`) — empty, single `Text` column. Junk; can be deleted by an admin.

### 3.5 Important: how the rollup actually works

The `Master Records.Current Month Spending` Lookup is configured (verified 2026-05-12) as:

```
bitable::$table[tblVkJV8f3RCY8xi]
  .FILTER(
    CurrentValue.$column[fldciyrpG5] = $table[tblhhsgGkvjFqVzM].$field[fldMDNP9Cg]  // Name match
    && CurrentValue.$column[fldekE0CIZ] = $table[tblhhsgGkvjFqVzM].$field[fldIwl1FgX]  // Month Number match
  )
  .$column[fld1MkwveV]  // Spent Value
  .LISTCOMBINE().SUM()
```

Implications:

- The filter keys on **Name text**, not the Manager Link. The Manager Link is bonus metadata,
  not load-bearing for the rollup. If a future schema migration drops the Name column,
  the rollup must be reconfigured to use the link first.
- The Month Number formula on each row is the canonical source. Don't store month elsewhere.
- The rollup reads from `Transaction History` (the aggregator), **not** from the 52 per-manager
  tables. The per-manager tables can be deleted in the future without breaking the rollup.

---

## 4. The application

### 4.1 Routes

| Route | Method | Purpose |
|---|---|---|
| `/` | GET | Landing page (placeholder). |
| `/m/[recordId]` | GET (server component) | Cashier-facing form. Fetches manager + branches + current spending in parallel. |
| `/api/transactions` | POST | Submit a transaction. **Full server-side validation.** |

### 4.2 `/api/transactions` validation order

```
1. JSON parse                         → 400 "Invalid JSON"
2. managerRecordId present (string)   → 400 "Missing manager"
3. branchName present (string)        → 400 "Missing branch"
4. orNumber present (non-empty)       → 400 "Missing OR number"
5. spentValue is finite positive #    → 400 "Spent value must be a positive number"
6. manager exists in Master Records   → 404 "Manager not found"
7. manager.Position !~ /resign/i      → 403 "Manager is inactive"
8. branchName in Lark SingleSelect    → 400 "Unknown branch"
9. spentValue <= Available Balance    → 409 "Exceeds available balance. Available: ₱X.XX"
10. Otherwise: write to Lark, return  → 200 { ok, transactionId, spent, newRemaining }
```

The client form (`MealForm.tsx`) shows the over-limit warning live as the user types, but
that is convenience. Step 9 is the authoritative check.

### 4.3 The Lark client (`src/lib/lark.ts`)

- One module, lambda-scoped `tenant_access_token` cache (TTL 7200s; refresh 5min before expiry).
- All API calls use built-in `fetch`. No third-party SDKs.
- Errors throw with Lark's `code` + `msg` in the message — visible in Vercel logs.

### 4.4 The page (`src/app/m/[recordId]/page.tsx`)

Server component. Renders synchronously after the manager + branches + spending fetches resolve.
The client form (`MealForm.tsx`) only handles input + submit + the success/error UI.

### 4.5 UI conventions (MLG HRIS design system)

- Inline styles only (no Tailwind for color/typography).
- Background `#F5F0EE`, card border `#E0D5CF`, primary `#8B0000`, espresso text `#1A0000`.
- System fonts. No web fonts. No drop shadows on cards.
- Currency: `'₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- Dates: `Asia/Manila`, never UTC.
- Numeric weights as literals (`fontWeight: 700`), never `font-bold`.

---

## 5. Business rules

1. **Each manager has one monthly credit limit** stored in `Master Records.Credit`.
2. **The limit is confidential.** Never shown in the cashier UI. Only the
   *Available Balance* is shown (which is `Credit − Current Month Spending`).
3. **Monthly reset on the 1st of each calendar month** is automatic — the rollup filters by
   `Month Number` which is computed from `TODAY()` in Manila TZ. No cron, no batch job.
4. **Resigned managers are blocked.** If `Position` contains the string `resign`
   (case-insensitive), the page shows a red "Resigned" banner and the API returns 403.
5. **Owners have effectively unlimited credit** (₱999,999) — implemented as a high number,
   not a special flag. They still flow through the same validation pipeline.
6. **Cashier authentication: none, currently.** Anyone with the QR can submit. Future control
   should be a cashier login or a branch-level PIN; out of scope for v1.
7. **Currency:** PHP only. No multi-currency support.
8. **Timezone:** `Asia/Manila` for everything user-visible. The Lark `Date` field stores a
   Unix timestamp in milliseconds and Lark handles the local interpretation.

---

## 6. Operations

### 6.1 Environments

| Env | Purpose | Base URL |
|---|---|---|
| Local dev | `npm run dev` | `http://localhost:3000` |
| Vercel preview | Per-PR | Vercel auto-generated |
| Vercel production | `main` branch | TBD post-deploy |

### 6.2 Required env vars

```
LARK_APP_ID                  # Lark custom app ID, e.g. cli_xxx
LARK_APP_SECRET              # Lark custom app secret — rotate immediately if leaked
LARK_BASE_ID                 # The Bitable app token, e.g. DmiYbZsDha8RcWstSjNuh3tRsid
LARK_MANAGERS_TABLE_ID       # Optional override — defaults to Master Records id in code
LARK_TRANSACTIONS_TABLE_ID   # Optional override — defaults to Transaction History id in code
APP_BASE_URL                 # For QR generation only. Not read at runtime.
```

### 6.3 Secrets handling

- **Never commit `.env.local`** — `.gitignore` covers it but always double-check `git status`
  before any `git add`.
- **Never paste secrets in chat / commit messages / PR descriptions.** They live in transcripts
  forever. If a secret leaks: rotate immediately in the Lark Developer Console, update
  `.env.local`, update Vercel env vars, redeploy.
- **Rotated 2026-05-12** after initial paste during scoping discussion.

### 6.4 Deployment

GitHub-connected Vercel project (no CI config in repo — Vercel handles it). Push to `main`
triggers a production deploy; PRs get preview URLs.

### 6.5 QR code regeneration

After any change to `APP_BASE_URL`:

```
python scripts/generate_qrs.py https://your-app.vercel.app
```

Output lands in `qr/` (gitignored). Print + distribute to managers.

### 6.6 Observability

- Vercel function logs are the primary surface for runtime errors.
- Lark errors include `code` + `msg`; common ones:
  - `99991661` — invalid `tenant_access_token` (clear `cachedToken` and retry, but normally the cache logic prevents this).
  - `1254603` — record not found.
  - `1254015` — field constraint violation (e.g. branch name not in SingleSelect).

---

## 7. Glossary

- **Master Records** — the manager roster table in Lark Base. One row per manager.
- **Transaction History** — the flat transaction log in Lark Base. App writes here.
- **Per-manager table** — one of 52 legacy tables, one per manager. Historical archive only.
- **Available Balance** — what the cashier sees. Equals `Credit − Current Month Spending`.
- **Month Number** — Lark formula concatenating month + year (e.g. `52026` for May 2026).
  Drives the rollup filter and the monthly reset.
- **OR Number** — Official Receipt number. The cashier types this from the printed OR.
- **Branch** — One of ~30 MLG restaurant locations. SingleSelect options in Transaction History.
- **Tenant access token** — Lark's server-side bearer token, app-secret-derived, 7200s TTL.

---

## 8. Known issues and tech debt

| Severity | Issue | Notes |
|---|---|---|
| ~~Low~~ | ~~`Month` formula on Transaction History returns `"Invalid Month"`~~ | **Fixed 2026-05-14.** Was `SWITCH(Month Number, …)` which never matched 1-12 (Month Number is `MONTH+YEAR`). Now `SWITCH(MONTH(Date), …)` → returns `"May"`, `"June"`, etc. |
| Low | 52 per-manager tables clutter the base | Can be deleted once we're confident no other tool depends on them. |
| Low | Two `OR Number` types across legacy tables (Text vs Number) | Cosmetic. New writes go to Transaction History only. |
| Medium | Branch SingleSelect has duplicate options (`BGC` ×2, `EVO` ×3, `NAIA T3` ×2) | **Partial fix 2026-05-14:** `Manilay Bay` typo renamed to `Manila Bay` (option id preserved, historical rows auto-update). Duplicates still pending — needs manual merge in Lark UI (re-pointing existing records is too risky to automate). |
| Medium | No cashier authentication | v1 ships without it. Add when scope allows (branch PIN is simplest). |
| Medium | Transaction IDs collide between legacy per-manager tables (`2505001` appears twice in history) | Web-written rows use the `YYMM-{hex}` format which cannot collide. |
| Low | Stale rollup if a transaction's Date is edited to a different month after creation | Out of normal flow. The rollup recomputes correctly on any read. |

---

## 9. Decisions log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-12 | Lark Base remains the system of record; we do not create a new database. | User explicit: "the base is the ultimate database." |
| 2026-05-12 | Add a `Manager` Link field on Transaction History (not load-bearing for rollup). | Future-proofing — survives name renames. Free metadata. |
| 2026-05-12 | Backfill all 723 historical rows with Manager link. | One-time, idempotent. Keeps the data clean for any later schema work. |
| 2026-05-12 | Keep the existing Lookup-style rollup on `Current Month Spending` as-is. | It already reads from Transaction History. Replacing it would break existing dashboards for no gain. |
| 2026-05-12 | QR encodes `https://app/m/{lark_record_id}`. | Stable identifier, no extra Employee ID column needed in Master Records. |
| 2026-05-12 | Transaction ID format `YYMM-{6 hex}` for web-written rows. | Globally unique, preserves monthly grouping, distinguishes from legacy autonumber. |
| 2026-05-12 | Hide `Credit` from UI; show `Available Balance` only. | User: credit is confidential. |
| 2026-05-12 | No cashier auth in v1. | Faster to ship; access control via QR distribution + branch staff supervision. |
| 2026-05-14 | Deployed to Vercel via GitHub integration. | Auto-deploy on push to main; preview URLs per PR. |
| 2026-05-14 | Branded QR cards generated alongside plain QR PNGs. | Optional `assets/mlg-logo.png` replaces typographic wordmark when present. |
| 2026-05-14 | Auto-merge of duplicate branch options deferred. | Re-pointing existing record references is too risky to automate; manual merge in Lark UI is safer. |

---

## 10. Future work

Not committed, listed so we don't lose ideas:

- **Admin dashboard** (`/admin`) — view all transactions, filter by manager/branch/month, export CSV.
- **Cashier authentication** — branch PIN or Lark SSO.
- **Receipt photo upload** — attach a photo of the OR to each transaction.
- **Monthly statement email** — each manager gets a summary on the 1st (or last) of the month.
- **Branch cleanup** — dedupe the SingleSelect options in Lark, fix the typo.
- **Retire the 52 per-manager tables** — keep an export for audit, then delete.

---

## 11. How to update this document

- When you change a Lark field, table, or formula, update §3.
- When you add or change an API route or business rule, update §4 and §5.
- When you change deployment, env vars, or operations, update §6.
- When you find a new bug, add to §8.
- When you make a non-trivial decision, log it in §9 with a date and reason.

If you change something in code without updating this file, the file becomes a lie. Don't.
