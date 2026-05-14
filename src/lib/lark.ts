// Server-only Lark Suite Bitable client.
// Caches tenant_access_token across requests in the lambda's warm process.

import "server-only";

const HOST = "https://open.larksuite.com";
const BASE_ID = process.env.LARK_BASE_ID!;
const APP_ID = process.env.LARK_APP_ID!;
const APP_SECRET = process.env.LARK_APP_SECRET!;

export const MASTER_TABLE = "tblhhsgGkvjFqVzM";
export const TXN_TABLE = "tblVkJV8f3RCY8xi";

// Field IDs (from Lark introspection — see scripts/inspect_lark_base.py)
export const F = {
  master: {
    name: "fldMDNP9Cg",
    position: "fldLnExxY6",
    credit: "fldR3vQnlB",
    currentMonthSpending: "fldcHcykIc",
    remainingCredit: "fld1Y1ZvwX",
    monthNumber: "fldIwl1FgX",
  },
  txn: {
    transactionId: "fldRusaCgr",
    name: "fldciyrpG5",
    spentValue: "fld1MkwveV",
    date: "fldZxGm9RU",
    orNumber: "fldzHRSvxl",
    monthNumber: "fldekE0CIZ",
    branch: "fldJ7sykaC",
    manager: "fldNPRrmLA",
  },
} as const;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getTenantToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 5 * 60 * 1000 > now) {
    return cachedToken.token;
  }
  const res = await fetch(`${HOST}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    cache: "no-store",
  });
  const data = (await res.json()) as { code: number; msg?: string; tenant_access_token?: string; expire?: number };
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Lark auth failed: ${data.code} ${data.msg ?? ""}`);
  }
  cachedToken = { token: data.tenant_access_token, expiresAt: now + (data.expire ?? 7200) * 1000 };
  return cachedToken.token;
}

async function larkFetch<T = unknown>(
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "PATCH"; body?: unknown } = {}
): Promise<T> {
  const token = await getTenantToken();
  const res = await fetch(`${HOST}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json()) as { code: number; msg?: string; data?: T };
  if (data.code !== 0) {
    throw new Error(`Lark ${path} failed: ${data.code} ${data.msg ?? ""}`);
  }
  return (data.data ?? {}) as T;
}

// Lark returns text fields in a few shapes:
//   - plain string: "Alex Cruz"
//   - array of parts: [{text: "Alex", type: "text"}]
//   - Formula envelope: {type: 1, value: [{text: "52026", type: "text"}]}
//   - empty link: {} or {value: []}
export function textOf(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (Array.isArray(v)) {
    return v
      .map((p) => (typeof p === "object" && p !== null && "text" in p ? (p as { text: string }).text : String(p)))
      .join("")
      .trim();
  }
  if (typeof v === "object") {
    const o = v as { value?: unknown; text?: unknown };
    if (Array.isArray(o.value)) return textOf(o.value);
    if (typeof o.text === "string") return o.text.trim();
    return "";
  }
  return "";
}

export type ManagerRecord = {
  recordId: string;
  name: string;
  position: string;
  credit: number;
  monthNumber: string; // e.g. "52026"
  employeeId: string;
};

export type Transaction = {
  recordId: string;
  transactionId: string;
  managerName: string;
  managerRecordId: string | null;
  branch: string;
  orNumber: string;
  spentValue: number;
  date: number; // ms epoch
  monthNumber: string;
  month: string;
};

type LarkRecord = { record_id: string; fields: Record<string, unknown> };

function toManager(r: LarkRecord): ManagerRecord {
  const f = r.fields;
  return {
    recordId: r.record_id,
    name: textOf(f.Name),
    position: textOf(f.Position),
    credit: typeof f.Credit === "number" ? (f.Credit as number) : Number(textOf(f.Credit)) || 0,
    monthNumber: textOf(f["Month Number"]),
    employeeId: textOf(f["Employee ID"]),
  };
}

function toTransaction(r: LarkRecord): Transaction {
  const f = r.fields;
  const dateRaw = f.Date;
  const date = typeof dateRaw === "number" ? dateRaw : Number(dateRaw) || 0;
  // Manager field shape: [{ record_ids: ['recXXX'], text_arr: ['Name'], ... }]
  let managerRecordId: string | null = null;
  const m = f.Manager;
  if (Array.isArray(m) && m.length > 0 && typeof m[0] === "object" && m[0] !== null) {
    const entry = m[0] as { record_ids?: string[] };
    if (Array.isArray(entry.record_ids) && entry.record_ids[0]) {
      managerRecordId = entry.record_ids[0];
    }
  }
  return {
    recordId: r.record_id,
    transactionId: textOf(f["Transaction ID"]),
    managerName: textOf(f.Name),
    managerRecordId,
    branch: textOf(f.Branch),
    orNumber: textOf(f["OR Number"]),
    spentValue: typeof f["Spent Value"] === "number" ? (f["Spent Value"] as number) : Number(textOf(f["Spent Value"])) || 0,
    date,
    monthNumber: textOf(f["Month Number"]),
    month: textOf(f.Month),
  };
}

export async function getManager(recordId: string): Promise<ManagerRecord | null> {
  try {
    const data = await larkFetch<{ record: LarkRecord }>(
      `/open-apis/bitable/v1/apps/${BASE_ID}/tables/${MASTER_TABLE}/records/${recordId}`
    );
    if (!data.record) return null;
    return toManager(data.record);
  } catch {
    return null;
  }
}

export async function listManagers(): Promise<ManagerRecord[]> {
  const out: ManagerRecord[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({ page_size: "500" });
    if (pageToken) qs.set("page_token", pageToken);
    const data = await larkFetch<{ items: LarkRecord[]; has_more: boolean; page_token?: string }>(
      `/open-apis/bitable/v1/apps/${BASE_ID}/tables/${MASTER_TABLE}/records?${qs.toString()}`
    );
    out.push(...(data.items ?? []).map(toManager));
    pageToken = data.has_more ? data.page_token : undefined;
  } while (pageToken);
  return out;
}

export async function sumCurrentMonthSpending(managerRecordId: string, monthNumber: string): Promise<number> {
  // Search Transaction History for this manager + month, sum Spent Value.
  const data = await larkFetch<{ items?: LarkRecord[]; has_more?: boolean; page_token?: string }>(
    `/open-apis/bitable/v1/apps/${BASE_ID}/tables/${TXN_TABLE}/records/search?page_size=500`,
    {
      method: "POST",
      body: {
        filter: {
          conjunction: "and",
          conditions: [
            { field_name: "Manager", operator: "contains", value: [managerRecordId] },
            { field_name: "Month Number", operator: "is", value: [monthNumber] },
          ],
        },
        field_names: ["Spent Value", "Month Number", "Manager"],
      },
    }
  );
  let total = 0;
  for (const it of data.items ?? []) {
    const v = it.fields["Spent Value"];
    if (typeof v === "number") total += v;
    else total += Number(textOf(v)) || 0;
  }
  return total;
}

export async function listManagerTransactions(managerRecordId: string): Promise<Transaction[]> {
  const out: Transaction[] = [];
  let pageToken: string | undefined;
  do {
    const data = await larkFetch<{ items?: LarkRecord[]; has_more?: boolean; page_token?: string }>(
      `/open-apis/bitable/v1/apps/${BASE_ID}/tables/${TXN_TABLE}/records/search?page_size=500${pageToken ? `&page_token=${pageToken}` : ""}`,
      {
        method: "POST",
        body: {
          filter: {
            conjunction: "and",
            conditions: [{ field_name: "Manager", operator: "contains", value: [managerRecordId] }],
          },
        },
      }
    );
    for (const it of data.items ?? []) out.push(toTransaction(it));
    pageToken = data.has_more ? data.page_token : undefined;
  } while (pageToken);
  // Sort newest-first
  out.sort((a, b) => b.date - a.date);
  return out;
}

export async function listTransactionsByMonth(monthNumber: string): Promise<Transaction[]> {
  const out: Transaction[] = [];
  let pageToken: string | undefined;
  do {
    const data = await larkFetch<{ items?: LarkRecord[]; has_more?: boolean; page_token?: string }>(
      `/open-apis/bitable/v1/apps/${BASE_ID}/tables/${TXN_TABLE}/records/search?page_size=500${pageToken ? `&page_token=${pageToken}` : ""}`,
      {
        method: "POST",
        body: {
          filter: {
            conjunction: "and",
            conditions: [{ field_name: "Month Number", operator: "is", value: [monthNumber] }],
          },
        },
      }
    );
    for (const it of data.items ?? []) out.push(toTransaction(it));
    pageToken = data.has_more ? data.page_token : undefined;
  } while (pageToken);
  out.sort((a, b) => b.date - a.date);
  return out;
}

export async function listBranchOptions(): Promise<{ id: string; name: string }[]> {
  const data = await larkFetch<{ items: Array<{ field_id: string; field_name: string; property?: { options?: Array<{ id: string; name: string }> } }> }>(
    `/open-apis/bitable/v1/apps/${BASE_ID}/tables/${TXN_TABLE}/fields?page_size=100`
  );
  const branch = (data.items ?? []).find((f) => f.field_name === "Branch");
  const seen = new Set<string>();
  const out: { id: string; name: string }[] = [];
  for (const opt of branch?.property?.options ?? []) {
    if (seen.has(opt.name)) continue;
    seen.add(opt.name);
    out.push({ id: opt.id, name: opt.name });
  }
  return out;
}

export type NewTransaction = {
  managerRecordId: string;
  managerName: string;
  branchName: string;
  orNumber: string;
  spentValue: number;
};

export async function createTransaction(t: NewTransaction): Promise<{ recordId: string; transactionId: string }> {
  const txnId = generateTransactionId();
  const fields: Record<string, unknown> = {
    "Transaction ID": txnId,
    Name: t.managerName,
    "Spent Value": t.spentValue,
    Date: Date.now(),
    "OR Number": t.orNumber,
    Branch: t.branchName,
    Manager: [t.managerRecordId],
  };
  const data = await larkFetch<{ record: LarkRecord }>(
    `/open-apis/bitable/v1/apps/${BASE_ID}/tables/${TXN_TABLE}/records`,
    { method: "POST", body: { fields } }
  );
  return { recordId: data.record.record_id, transactionId: txnId };
}

function generateTransactionId(): string {
  // Format: YYMM-{6 hex} — globally unique, monthly grouping preserved.
  // Use Manila time to stay consistent with Lark formulas that key on local date.
  const now = new Date();
  const manila = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const yy = String(manila.getFullYear()).slice(-2);
  const mm = String(manila.getMonth() + 1).padStart(2, "0");
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${yy}${mm}-${hex}`;
}

// Compute Lark's "Month Number" format for the current Manila month.
// Matches the formula CONCATENATE(MONTH(TODAY()), YEAR(TODAY())) → "52026" for May 2026.
export function currentMonthNumber(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  return `${now.getMonth() + 1}${now.getFullYear()}`;
}
